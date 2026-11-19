// Face ID / impronta per la tessera del cliente (passkey, standard WebAuthn).
// Il volto o l'impronta restano sul telefono: qui arriva solo la firma della chiave, verificata con la chiave pubblica.
import {
  generateAuthenticationOptions, generateRegistrationOptions,
  verifyAuthenticationResponse, verifyRegistrationResponse,
} from 'npm:@simplewebauthn/server@13.1.1';

export interface Info {
  cliente_id: string; nome: string; telefono: string; pizzeria: string; attiva: boolean;
  dispositivo_ok: boolean; impronta: string;
  credenziali: { id: string; chiave: string; contatore: number; trasporti: string[] }[];
}
export interface Db {
  info(pizzeria: string, telefono: string, dispositivo: string): Promise<Info | null>;
  salvaSfida(cliente: string, impronta: string, tipo: string, sfida: string): Promise<string>;
  prendiSfida(id: string): Promise<{ cliente_id: string; impronta: string; tipo: string; sfida: string; scade: string } | null>;
  salvaCredenziale(cliente: string, id: string, chiave: string, contatore: number, trasporti: string[]): Promise<void>;
  aggiornaContatore(id: string, contatore: number): Promise<void>;
  confermato(cliente: string, impronta: string): Promise<void>;
}

const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const da64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const uuidBytes = (u: string) => Uint8Array.from(u.replace(/-/g, '').match(/../g)!.map(h => parseInt(h, 16)));

export class Errore extends Error { constructor(m: string, public status = 400) { super(m); } }

export async function gestisci(db: Db, origini: string[], origin: string | null, body: Record<string, any>) {
  if (!origin || !origini.includes(origin)) throw new Error('Origine non ammessa');
  const rpID = new URL(origin).hostname;
  const { azione, pizzeria, telefono, dispositivo } = body;
  if (!pizzeria || !telefono || !dispositivo) throw new Errore('Dati mancanti');
  const info = await db.info(pizzeria, telefono, dispositivo);
  if (!info) throw new Errore('Cliente non trovato');
  if (!info.attiva) throw new Errore('La pizzeria non usa Face ID o impronta');

  if (azione === 'registra-opzioni') {
    // si attiva solo dal telefono già abilitato, così nessun altro può legare il proprio volto alla tessera
    if (!info.dispositivo_ok) throw new Errore('Attiva Face ID o impronta dal telefono con cui ti sei registrato', 403);
    const opz = await generateRegistrationOptions({
      rpName: info.pizzeria, rpID, userName: '+' + info.telefono, userDisplayName: info.nome || ('+' + info.telefono),
      userID: uuidBytes(info.cliente_id), attestationType: 'none',
      excludeCredentials: info.credenziali.map(c => ({ id: c.id, transports: c.trasporti as any })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required', authenticatorAttachment: 'platform' },
    });
    const sfida = await db.salvaSfida(info.cliente_id, info.impronta, 'registra', opz.challenge);
    return { opzioni: opz, sfida };
  }
  if (azione === 'accedi-opzioni') {
    if (!info.credenziali.length) throw new Errore('Face ID o impronta non ancora attivati', 404);
    const opz = await generateAuthenticationOptions({
      rpID, userVerification: 'required',
      allowCredentials: info.credenziali.map(c => ({ id: c.id, transports: c.trasporti as any })),
    });
    const sfida = await db.salvaSfida(info.cliente_id, info.impronta, 'accedi', opz.challenge);
    return { opzioni: opz, sfida };
  }
  if (azione === 'registra-verifica' || azione === 'accedi-verifica') {
    const tipo = azione === 'registra-verifica' ? 'registra' : 'accedi';
    const s = body.sfida ? await db.prendiSfida(body.sfida) : null;   // usa e cancella: una sfida vale una volta
    if (!s || s.tipo !== tipo || s.cliente_id !== info.cliente_id || s.impronta !== info.impronta || new Date(s.scade) < new Date())
      throw new Errore('Richiesta scaduta, riprova');
    if (tipo === 'registra') {
      if (!info.dispositivo_ok) throw new Errore('Telefono non abilitato', 403);
      const v = await verifyRegistrationResponse({ response: body.risposta, expectedChallenge: s.sfida, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
      if (!v.verified || !v.registrationInfo) throw new Errore('Face ID o impronta non confermati');
      const c = v.registrationInfo.credential;
      await db.salvaCredenziale(info.cliente_id, c.id, b64u(c.publicKey), c.counter, (c.transports || []) as string[]);
    } else {
      const cred = info.credenziali.find(c => c.id === body.risposta?.id);
      if (!cred) throw new Errore('Questa chiave non appartiene alla tessera');
      const v = await verifyAuthenticationResponse({
        response: body.risposta, expectedChallenge: s.sfida, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
        credential: { id: cred.id, publicKey: da64u(cred.chiave), counter: Number(cred.contatore), transports: cred.trasporti as any },
      });
      if (!v.verified) throw new Errore('Face ID o impronta non confermati');
      await db.aggiornaContatore(cred.id, v.authenticationInfo.newCounter);
    }
    await db.confermato(info.cliente_id, info.impronta);
    return { ok: true };
  }
  throw new Errore('Azione sconosciuta');
}
