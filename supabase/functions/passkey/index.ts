// Edge Function: Face ID / impronta (passkey) per la tessera del cliente
import { admin, CORS, json, SITE_URL } from '../_shared/comune.ts';
import { Db, Errore, gestisci } from './logica.ts';

const ORIGINI = [SITE_URL, ...(Deno.env.get('PASSKEY_ORIGINS') || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean)];

const db: Db = {
  async info(p, t, d) { const { data, error } = await admin.rpc('passkey_info', { p_pizzeria: p, p_telefono: t, p_dispositivo: d }); if (error) throw error; return data; },
  async salvaSfida(cliente_id, impronta, tipo, sfida) {
    await admin.from('sfide_passkey').delete().lt('scade', new Date().toISOString());
    const { data, error } = await admin.from('sfide_passkey').insert({ cliente_id, impronta, tipo, sfida }).select('id').single(); if (error) throw error; return data.id;
  },
  async prendiSfida(id) {
    const { data, error } = await admin.from('sfide_passkey').delete().eq('id', id).select('cliente_id, impronta, tipo, sfida, scade').maybeSingle(); if (error) throw error; return data;
  },
  async salvaCredenziale(cliente_id, credential_id, chiave_pubblica, contatore, trasporti) {
    const { error } = await admin.from('passkey_cliente').insert({ cliente_id, credential_id, chiave_pubblica, contatore, trasporti }); if (error) throw error;
  },
  async aggiornaContatore(id, contatore) {
    const { error } = await admin.from('passkey_cliente').update({ contatore, usato_il: new Date().toISOString() }).eq('credential_id', id); if (error) throw error;
  },
  async confermato(c, i) { const { error } = await admin.rpc('passkey_confermato', { p_cliente: c, p_impronta: i }); if (error) throw error; },
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    return json(await gestisci(db, ORIGINI, req.headers.get('origin'), await req.json()));
  } catch (e) {
    const status = e instanceof Errore ? e.status : 400;
    console.error('passkey', e);
    return json({ error: e instanceof Errore ? e.message : 'Face ID o impronta non confermati, riprova' }, status);
  }
});
