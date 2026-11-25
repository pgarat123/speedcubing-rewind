import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../api/wca/token';

const req = (body: unknown) => new Request('http://localhost/api/wca/token', { method: 'POST', body: JSON.stringify(body) });
const valid = { code: 'abc', code_verifier: 'v'.repeat(64), redirect_uri: 'http://localhost:5173/callback' };

describe('fonction /api/wca/token', () => {
  beforeEach(() => {
    vi.stubEnv('WCA_CLIENT_ID', 'id');
    vi.stubEnv('WCA_CLIENT_SECRET', 'secret');
    vi.stubEnv('WCA_REDIRECT_URIS', 'http://localhost:5173/callback, https://rewind.example/callback');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('refuse une redirect_uri non autorisée sans appeler la WCA', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await POST(req({ ...valid, redirect_uri: 'https://evil.example/callback' }));
    expect(r.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse une requête incomplète', async () => {
    expect((await POST(req({ code: 'abc' }))).status).toBe(400);
  });

  it('échange le code et ne renvoie que le jeton d\'accès', async () => {
    const fetchMock = vi.fn(async () => Response.json({ access_token: 'tok', refresh_token: 'secret-refresh', expires_in: 7200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await POST(req(valid));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ access_token: 'tok', expires_in: 7200 });
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://www.worldcubeassociation.org/oauth/token');
    const form = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(form)).toMatchObject({ grant_type: 'authorization_code', client_id: 'id', client_secret: 'secret', code: 'abc', code_verifier: valid.code_verifier });
  });

  it('remonte une erreur 502 si la WCA refuse le code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    expect((await POST(req(valid))).status).toBe(502);
  });
});
