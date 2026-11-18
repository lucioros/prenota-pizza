# Prenota la Pizza

Web app per gli ordini da asporto di una pizzeria: ordini online, totem nel locale, coda del forno in tempo reale e impostazioni.

- `public/index.html` — pagina ordini per i clienti (`?p=il-forno`, aggiungi `&totem=1` per il totem)
- `public/gestione.html` — area pizzeria: accesso, coda forno, impostazioni
- Database: Supabase (prezzi e orario di ritiro calcolati nel database dalle funzioni `stima_ritiro` e `crea_ordine`)

Sito statico: nessuna build, si pubblica la cartella `public`.

## Pagamenti
Stripe Connect (account Standard per ogni pizzeria). Edge Functions in `supabase/functions`:
`pagamento-checkout`, `stripe-webhook`, `stripe-collega`. Segreti richiesti: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
