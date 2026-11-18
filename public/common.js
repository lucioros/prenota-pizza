// Collegamento a Supabase: la chiave "publishable" è fatta per stare nel browser,
// la sicurezza la garantiscono le regole RLS e le funzioni del database.
const SUPABASE_URL = 'https://mfpirpuynbwhvvhlroit.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Bihmdtif675LrrlFeKHY7g_yVh1mtaE';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const MIN = 60000, DAY = 86400000;
const CATS = ['Formaggi', 'Salumi', 'Verdure', 'Pesce', 'Extra'];
const $ = s => document.querySelector(s);
const eur = n => (+n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const r2 = n => Math.round(n * 100) / 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ora = t => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
function giorno(t) { const a = new Date(t), b = new Date(); return a.toDateString() === b.toDateString() ? '' : a.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric' }); }
function hm(str, base) { const [h, m] = String(str || '0:0').split(':').map(Number); const d = new Date(base); d.setHours(h || 0, m || 0, 0, 0); return d.getTime(); }
// Stessa regola del database: aperti adesso, altrimenti dalla prossima apertura
function servizio(p, t = Date.now()) {
  const dur = (((hm(p.chiusura, t) - hm(p.apertura, t)) % DAY) + DAY) % DAY || DAY;
  let o = hm(p.apertura, t); if (o > t) o -= DAY;
  if (t < o + dur) return { start: t, close: o + dur, aperto: true };
  return { start: o + DAY, close: o + DAY + dur, aperto: false };
}
function toast(msg, err) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.toggle('bad', !!err); t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, err ? 5000 : 2500);
}
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
const params = new URLSearchParams(location.search);
const SLUG = params.get('p') || 'il-forno';
const msgErr = e => (e && (e.message || e.error_description)) || 'Qualcosa non ha funzionato. Riprova.';
// Errori delle Edge Functions: il messaggio vero è nel corpo della risposta
async function invoca(nome, body) {
  const { data, error } = await sb.functions.invoke(nome, { body });
  if (!error) return { data };
  let msg = msgErr(error);
  try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) { }
  return { error: msg };
}
