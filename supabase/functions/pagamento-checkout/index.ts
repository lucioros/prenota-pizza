// Crea la pagina di pagamento Stripe per un ordine "in attesa di pagamento".
// L'importo si prende dal database (calcolato da crea_ordine), mai dal browser.
import { admin, CORS, json, SITE_URL, stripe } from '../_shared/comune.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);
  try {
    const { ordine_id } = await req.json();
    if (typeof ordine_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(ordine_id)) return json({ error: 'Ordine non valido' }, 400);

    const { data: o, error } = await admin.from('ordini')
      .select('id, numero, stato, pagamento, totale, sconti, creato_il, nome_cliente, pizzeria_id, righe_ordine(nome, formato_nome, impasto_nome, aggiunte, tolti, quantita, prezzo_unitario), pizzerie(slug, nome)')
      .eq('id', ordine_id).maybeSingle();
    if (error) throw error;
    if (!o) return json({ error: 'Ordine non trovato' }, 404);
    if (o.pagamento !== 'online' || o.stato !== 'attesa_pagamento') return json({ error: 'Questo ordine non è in attesa di pagamento' }, 409);
    if (Date.now() - new Date(o.creato_il).getTime() > 30 * 60000) return json({ error: 'Il tempo per pagare è scaduto: rifai l\'ordine' }, 410);

    const { data: acc } = await admin.from('pizzerie_stripe').select('stripe_account_id, pagamenti_attivi').eq('pizzeria_id', o.pizzeria_id).maybeSingle();
    if (!acc?.pagamenti_attivi) return json({ error: 'La pizzeria non ha ancora attivato i pagamenti online' }, 409);

    const pz = o.pizzerie as unknown as { slug: string; nome: string };
    const torna = (esito: string) => `${SITE_URL}/?p=${encodeURIComponent(pz.slug)}&pagamento=${esito}&ordine=${o.id}`;
    // Una sola voce con il totale già scontato; il dettaglio delle pizze va nella descrizione
    // deno-lint-ignore no-explicit-any
    const elenco = (o.righe_ordine as any[]).map((r) => `${r.quantita}× ${r.nome} (${r.formato_nome})`).join(', ');
    // deno-lint-ignore no-explicit-any
    const sconti = ((o as any).sconti || []).map((s: { descrizione: string }) => s.descrizione).join(', ');
    const line_items = { 0: { quantity: 1, price_data: { currency: 'eur', unit_amount: Math.round(Number(o.totale) * 100),
      product_data: { name: `Ordine #${o.numero} - ${pz.nome}`, description: (elenco + (sconti ? ` · Sconti: ${sconti}` : '')).slice(0, 500) } } } };
    if (Math.round(Number(o.totale) * 100) < 50) return json({ error: 'Importo troppo basso per il pagamento online: paga al ritiro' }, 409);

    // Commissione facoltativa per chi gestisce la piattaforma (percentuale, es. 2 = 2%)
    const perc = Number(Deno.env.get('COMMISSIONE_PERCENTO') || 0);
    const fee = perc > 0 ? Math.round(Number(o.totale) * 100 * perc / 100) : 0;

    const session = await stripe('POST', '/v1/checkout/sessions', {
      mode: 'payment',
      locale: 'it',
      line_items,
      success_url: torna('ok'),
      cancel_url: torna('annullato'),
      client_reference_id: o.id,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      metadata: { ordine_id: o.id, numero: o.numero },
      payment_intent_data: { metadata: { ordine_id: o.id }, description: `Ordine #${o.numero} - ${pz.nome}`, ...(fee ? { application_fee_amount: fee } : {}) },
    }, acc.stripe_account_id);

    await admin.from('ordini').update({ stripe_session_id: session.id }).eq('id', o.id);
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || 'Errore' }, 500);
  }
});
