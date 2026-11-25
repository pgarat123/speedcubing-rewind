/**
 * Sous-ensemble des réponses de l'API publique WCA (/api/v0) utilisé par l'app.
 * Les temps sont en centièmes de seconde ; -1 = DNF, -2 = DNS, 0 = pas de résultat.
 * FMC : single en nombre de coups, moyenne en coups × 100.
 * MBLD : valeur encodée 0DDTTTTTMM (plus petit = meilleur).
 */

export interface WcaMe {
  me: {
    id: number;
    wca_id: string | null;
    name: string;
    country_iso2: string;
    avatar?: { url: string; thumb_url: string };
  };
}

export interface WcaRank {
  best: number;
  world_rank: number;
  continent_rank: number;
  country_rank: number;
}

export interface WcaPersonResponse {
  person: {
    wca_id: string;
    name: string;
    country_iso2: string;
    avatar?: { url: string; thumb_url: string };
  };
  competition_count: number;
  personal_records: Record<string, { single?: WcaRank; average?: WcaRank }>;
  medals: { gold: number; silver: number; bronze: number; total: number };
  records: { national: number; continental: number; world: number; total: number };
}

export interface WcaResult {
  id: number;
  competition_id: string;
  event_id: string;
  round_type_id: string;
  pos: number;
  best: number;
  average: number;
  attempts: number[];
  regional_single_record: string | null;
  regional_average_record: string | null;
}

export interface WcaCompetition {
  id: string;
  name: string;
  city: string;
  country_iso2: string;
  start_date: string;
  end_date: string;
  latitude_degrees: number;
  longitude_degrees: number;
  event_ids: string[];
}
