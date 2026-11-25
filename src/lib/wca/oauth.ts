import { WCA_ORIGIN } from './client';

/**
 * Connexion WCA en authorization code + PKCE (S256).
 * L'échange du code se fait via /api/wca/token (fonction Vercel), car
 * /oauth/token de la WCA ne renvoie pas d'en-têtes CORS.
 * Le jeton reste en sessionStorage : il disparaît à la fermeture de l'onglet.
 */

const VERIFIER_KEY = 'wca.pkce.verifier';
const STATE_KEY = 'wca.pkce.state';
const TOKEN_KEY = 'wca.token';

export function redirectUri(): string {
  return `${window.location.origin}/callback`;
}

export async function startWcaLogin(clientId: string): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(24);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const url = new URL(`${WCA_ORIGIN}/oauth/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'public',
    state,
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: 'S256',
  }).toString();
  window.location.assign(url.toString());
}

export class WcaLoginError extends Error {
  readonly code: 'denied' | 'state_mismatch' | 'exchange_failed';
  constructor(code: WcaLoginError['code'], message: string) {
    super(message);
    this.name = 'WcaLoginError';
    this.code = code;
  }
}

/** À appeler sur /callback. Renvoie le jeton d'accès et nettoie l'URL. */
export async function completeWcaLogin(search: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const params = new URLSearchParams(search);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (params.get('error')) throw new WcaLoginError('denied', params.get('error_description') ?? 'Connexion refusée');
  const code = params.get('code');
  if (!code || !verifier || !expected || params.get('state') !== expected) {
    throw new WcaLoginError('state_mismatch', 'Réponse de connexion inattendue, réessaie.');
  }

  const res = await fetchImpl('/api/wca/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: redirectUri() }),
  });
  if (!res.ok) throw new WcaLoginError('exchange_failed', `Échange du code impossible (HTTP ${res.status})`);
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new WcaLoginError('exchange_failed', 'Jeton absent de la réponse');
  sessionStorage.setItem(TOKEN_KEY, access_token);
  return access_token;
}

export function storedToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

function randomString(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64Url(buf);
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return base64Url(new Uint8Array(digest));
}

export function base64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
