/**
 * Fonction Vercel : échange le code OAuth WCA contre un jeton d'accès.
 * Nécessaire car https://www.worldcubeassociation.org/oauth/token ne gère pas CORS.
 * Ne stocke rien et ne renvoie que le jeton d'accès (pas de refresh token).
 *
 * Variables d'environnement : WCA_CLIENT_ID, WCA_CLIENT_SECRET, WCA_REDIRECT_URIS.
 */

const WCA_TOKEN_URL = 'https://www.worldcubeassociation.org/oauth/token';

interface TokenRequest {
  code?: unknown;
  code_verifier?: unknown;
  redirect_uri?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const clientId = process.env.WCA_CLIENT_ID;
  const clientSecret = process.env.WCA_CLIENT_SECRET;
  const allowed = (process.env.WCA_REDIRECT_URIS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!clientId) return json({ error: 'server_misconfigured' }, 500);

  let body: TokenRequest;
  try {
    body = (await request.json()) as TokenRequest;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const { code, code_verifier, redirect_uri } = body;
  if (typeof code !== 'string' || typeof code_verifier !== 'string' || typeof redirect_uri !== 'string') {
    return json({ error: 'invalid_request' }, 400);
  }
  if (!allowed.includes(redirect_uri)) return json({ error: 'redirect_uri_not_allowed' }, 400);
  if (code.length > 512 || code_verifier.length < 43 || code_verifier.length > 128) {
    return json({ error: 'invalid_request' }, 400);
  }

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    code_verifier,
    redirect_uri,
  });
  if (clientSecret) form.set('client_secret', clientSecret);

  const res = await fetch(WCA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form,
  });
  if (!res.ok) return json({ error: 'exchange_failed', status: res.status }, 502);

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return json({ error: 'exchange_failed' }, 502);
  return json({ access_token: data.access_token, expires_in: data.expires_in ?? null }, 200);
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
