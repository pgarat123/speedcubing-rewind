import type { WcaCompetition, WcaMe, WcaPersonResponse, WcaResult } from './types';

/** Client de l'API WCA. /api/v0 renvoie Access-Control-Allow-Origin: *, donc appelable du navigateur. */

export const WCA_ORIGIN = 'https://www.worldcubeassociation.org';
const API = `${WCA_ORIGIN}/api/v0`;

export class WcaApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'WcaApiError';
    this.status = status;
  }
}

type Fetch = typeof fetch;

export interface WcaClientOptions {
  token?: string;
  fetchImpl?: Fetch;
  /** Nombre de requêtes compétitions en parallèle. */
  concurrency?: number;
}

export function createWcaClient({ token, fetchImpl = fetch, concurrency = 4 }: WcaClientOptions = {}) {
  const compCache = new Map<string, Promise<WcaCompetition>>();

  async function get<T>(path: string, auth = false, attempt = 0): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth) {
      if (!token) throw new WcaApiError(401, 'Jeton WCA manquant');
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetchImpl(`${API}${path}`, { headers });
    if (res.status === 429 && attempt < 3) {
      await sleep(1000 * 2 ** attempt);
      return get<T>(path, auth, attempt + 1);
    }
    if (!res.ok) throw new WcaApiError(res.status, `WCA ${path} : HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  function competition(id: string): Promise<WcaCompetition> {
    let p = compCache.get(id);
    if (!p) {
      p = get<WcaCompetition>(`/competitions/${encodeURIComponent(id)}`);
      p.catch(() => compCache.delete(id));
      compCache.set(id, p);
    }
    return p;
  }

  return {
    me: () => get<WcaMe>('/me', true),
    person: (wcaId: string) => get<WcaPersonResponse>(`/persons/${encodeURIComponent(wcaId)}`),
    results: (wcaId: string) => get<WcaResult[]>(`/persons/${encodeURIComponent(wcaId)}/results`),
    competition,
    /** Récupère plusieurs compétitions avec une concurrence limitée. */
    competitions: (ids: readonly string[]) => mapLimit([...new Set(ids)], concurrency, competition),
  };
}

export type WcaClient = ReturnType<typeof createWcaClient>;

export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
