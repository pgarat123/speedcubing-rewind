import type { Penalty, Solve, TimerExport, TimerSession } from './types';

/**
 * Parser de l'export csTimer ("Export to file").
 *
 * Structure constatée :
 *   {
 *     session1: [[[penalty, rawMs, ...splits], scramble, comment, unixSeconds], ...],
 *     session2: [...],
 *     properties: { sessionData: { "1": { name, opt: { scrType }, rank, ... } } }
 *   }
 * penalty vaut 0, 2000 (+2) ou -1 (DNF). sessionData est parfois une chaîne JSON.
 * Un scrType absent signifie le 3x3 par défaut.
 */

export type TimerParseErrorCode = 'not_json' | 'not_cstimer' | 'empty';

export class TimerParseError extends Error {
  readonly code: TimerParseErrorCode;
  constructor(code: TimerParseErrorCode, message: string) {
    super(message);
    this.name = 'TimerParseError';
    this.code = code;
  }
}

interface CsSessionMeta {
  name?: unknown;
  opt?: { scrType?: unknown };
  rank?: unknown;
}

const SESSION_KEY = /^session(\d+)$/;

export function parseCsTimer(text: string): TimerExport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new TimerParseError('not_json', "Le fichier n'est pas un JSON valide.");
  }
  if (!isRecord(data)) {
    throw new TimerParseError('not_cstimer', "Ce fichier ne ressemble pas à un export csTimer.");
  }

  const meta = readSessionData(data.properties);
  const sessionKeys = Object.keys(data).filter((k) => SESSION_KEY.test(k));
  if (sessionKeys.length === 0) {
    throw new TimerParseError('not_cstimer', "Aucune session csTimer trouvée dans ce fichier.");
  }

  const sessions: TimerSession[] = [];
  for (const key of sessionKeys) {
    const id = SESSION_KEY.exec(key)![1]!;
    const raw = data[key];
    const solves = Array.isArray(raw) ? raw.map(parseSolve).filter((s): s is Solve => s !== null) : [];
    const m = meta[id] ?? {};
    sessions.push({
      id,
      name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : `Session ${id}`,
      scrambleType: typeof m.opt?.scrType === 'string' ? m.opt.scrType : '333',
      rank: typeof m.rank === 'number' ? m.rank : Number(id),
      solves: solves.sort((a, b) => a.timestamp - b.timestamp),
    });
  }

  sessions.sort((a, b) => a.rank - b.rank);
  if (sessions.every((s) => s.solves.length === 0)) {
    throw new TimerParseError('empty', "L'export ne contient aucun solve.");
  }
  return { source: 'cstimer', sessions };
}

function readSessionData(properties: unknown): Record<string, CsSessionMeta> {
  if (!isRecord(properties)) return {};
  let sd = properties.sessionData;
  if (typeof sd === 'string') {
    try {
      sd = JSON.parse(sd);
    } catch {
      return {};
    }
  }
  return isRecord(sd) ? (sd as Record<string, CsSessionMeta>) : {};
}

function parseSolve(entry: unknown): Solve | null {
  if (!Array.isArray(entry) || !Array.isArray(entry[0])) return null;
  const [penaltyRaw, rawMs] = entry[0] as unknown[];
  const ts = entry[3];
  if (typeof rawMs !== 'number' || !Number.isFinite(rawMs) || rawMs <= 0) return null;
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return null;

  let penalty: Penalty = 'none';
  if (penaltyRaw === -1) penalty = 'dnf';
  else if (typeof penaltyRaw === 'number' && penaltyRaw > 0) penalty = 'plus2';

  const solve: Solve = { rawMs, penalty, timestamp: ts * 1000 };
  if (typeof entry[1] === 'string' && entry[1]) solve.scramble = entry[1];
  if (typeof entry[2] === 'string' && entry[2]) solve.comment = entry[2];
  return solve;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
