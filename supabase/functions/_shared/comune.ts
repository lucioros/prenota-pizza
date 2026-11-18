// Funzioni comuni alle Edge Functions dei pagamenti
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

export const SITE_URL = (Deno.env.get('SITE_URL') || 'https://prenota-pizza.onrender.com').replace(/\/+$/, '');

function chiaveSegreta(): string {
  try {
    const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    if (k.default) return k.default;
  } catch (_) { /* usa la chiave legacy */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}
// Client con pieni poteri: solo lato server
export const admin = createClient(Deno.env.get('SUPABASE_URL')!, chiaveSegreta(), { auth: { persistSession: false } });

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Chiamate all'API di Stripe senza librerie: parametri in formato form
function form(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}
export async function stripe(method: string, path: string, params?: Record<string, unknown>, account?: string) {
  const sk = Deno.env.get('STRIPE_SECRET_KEY');
  if (!sk) throw new Error('Pagamenti non configurati: manca la chiave Stripe');
  const headers: Record<string, string> = { Authorization: `Bearer ${sk}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  if (account) headers['Stripe-Account'] = account;
  let url = `https://api.stripe.com${path}`, body: string | undefined;
  if (params && method === 'GET') url += '?' + form(params).toString();
  else if (params) body = form(params).toString();
  const res = await fetch(url, { method, headers, body });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Errore Stripe ${res.status}`);
  return data;
}
