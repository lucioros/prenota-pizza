// Riceve gli avvisi di Stripe: pagamento riuscito, pagina scaduta, account della pizzeria aggiornato.
// Ogni avviso è firmato: senza firma valida viene rifiutato.
import { admin, json } from '../_shared/comune.ts';

const enc = new TextEncoder();
async function firmaValida(raw: string, header: string | null, secret: string) {
  if (!header) return false;
  const parti = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]).filter((p) => p[0] === 't'));
  const t = parti.t;
  const v1 = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !v1.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${raw}`)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
  return v1.some((s) => s.length === hex.length && [...s].reduce((a, c, i) => a | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

async function aggiornaAccount(acct: { id: string; charges_enabled: boolean; details_submitted: boolean }) {
  const { data } = await admin.from('pizzerie_stripe')
    .update({ pagamenti_attivi: acct.charges_enabled, dati_inviati: acct.details_submitted, aggiornato_il: new Date().toISOString() })
    .eq('stripe_account_id', acct.id).select('pizzeria_id');
  for (const r of data || []) await admin.from('pizzerie').update({ pagamenti_attivi: acct.charges_enabled }).eq('id', r.pizzeria_id);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);
  const raw = await req.text();
  const secrets = [Deno.env.get('STRIPE_WEBHOOK_SECRET'), Deno.env.get('STRIPE_WEBHOOK_SECRET_CONNECT')].filter(Boolean) as string[];
  if (!secrets.length) return json({ error: 'Webhook non configurato' }, 500);
  let ok = false;
  for (const s of secrets) if (await firmaValida(raw, req.headers.get('stripe-signature'), s)) { ok = true; break; }
  if (!ok) return json({ error: 'Firma non valida' }, 400);

  const ev = JSON.parse(raw);
  const obj = ev.data?.object || {};
  try {
    switch (ev.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        if (obj.payment_status !== 'paid') break;
        const id = obj.metadata?.ordine_id;
        if (!id) break;
        // anche se l'ordine era stato annullato per tempo scaduto, un pagamento riuscito lo rimette in coda
        await admin.from('ordini').update({ pagato: true, stato: 'ricevuto', stripe_payment_intent: obj.payment_intent })
          .eq('id', id).eq('stripe_session_id', obj.id).in('stato', ['attesa_pagamento', 'annullato']);
        break;
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await admin.from('ordini').update({ stato: 'annullato' }).eq('stripe_session_id', obj.id).eq('stato', 'attesa_pagamento');
        break;
      case 'account.updated':
        await aggiornaAccount(obj);
        break;
    }
  } catch (e) {
    console.error(e);
    return json({ error: 'Errore interno' }, 500);
  }
  return json({ ricevuto: true });
});
