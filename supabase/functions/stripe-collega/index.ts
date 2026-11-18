// Collega il conto Stripe di una pizzeria (Stripe Connect, account Standard).
// Solo chi lavora nella pizzeria può usarla.
import { admin, CORS, json, SITE_URL, stripe } from '../_shared/comune.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: 'Accedi di nuovo all\'area pizzeria' }, 401);

    const { pizzeria_id, azione } = await req.json();
    const { data: st } = await admin.from('staff').select('ruolo').eq('pizzeria_id', pizzeria_id).eq('user_id', u.user.id).maybeSingle();
    if (!st || st.ruolo !== 'gestore') return json({ error: 'Solo il titolare può gestire i pagamenti' }, 403);
    const { data: pz } = await admin.from('pizzerie').select('id, nome, slug').eq('id', pizzeria_id).single();
    let { data: acc } = await admin.from('pizzerie_stripe').select('*').eq('pizzeria_id', pizzeria_id).maybeSingle();

    const sincronizza = async (id: string) => {
      const a = await stripe('GET', `/v1/accounts/${id}`);
      await admin.from('pizzerie_stripe').update({ pagamenti_attivi: a.charges_enabled, dati_inviati: a.details_submitted, aggiornato_il: new Date().toISOString() }).eq('pizzeria_id', pizzeria_id);
      await admin.from('pizzerie').update({ pagamenti_attivi: a.charges_enabled }).eq('id', pizzeria_id);
      return { collegato: true, pagamenti_attivi: a.charges_enabled, dati_inviati: a.details_submitted };
    };

    if (azione === 'stato') {
      if (!acc) return json({ collegato: false, pagamenti_attivi: false, dati_inviati: false });
      return json(await sincronizza(acc.stripe_account_id));
    }

    if (azione === 'collega') {
      if (!acc) {
        const a = await stripe('POST', '/v1/accounts', {
          type: 'standard', country: 'IT', email: u.user.email,
          business_profile: { name: pz!.nome, url: `${SITE_URL}/?p=${pz!.slug}` },
          metadata: { pizzeria_id },
        });
        const ins = await admin.from('pizzerie_stripe').insert({ pizzeria_id, stripe_account_id: a.id }).select().single();
        if (ins.error) throw ins.error;
        acc = ins.data;
      }
      const link = await stripe('POST', '/v1/account_links', {
        account: acc!.stripe_account_id, type: 'account_onboarding',
        refresh_url: `${SITE_URL}/gestione.html?p=${pz!.slug}&stripe=riprova`,
        return_url: `${SITE_URL}/gestione.html?p=${pz!.slug}&stripe=ritorno`,
      });
      return json({ url: link.url });
    }
    return json({ error: 'Azione non valida' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || 'Errore' }, 500);
  }
});
