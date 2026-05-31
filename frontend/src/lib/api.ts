// ============================================================
// API CLIENT - Funções para comunicação com o Backend
// ============================================================
// Todas as chamadas HTTP para o backend NestJS são feitas aqui.
// O baseURL aponta para localhost:3001 em desenvolvimento.
// ============================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ============================================================
// TIPOS
// ============================================================

export interface Roll {
  id: string;
  color: "RED" | "BLACK" | "WHITE";
  roll_value: number;
  timestamp: string;
  server_seed: string | null;
  hash: string | null;
}

export interface HistoryResponse {
  data: Roll[];
  total: number;
  limit: number;
  offset: number;
}

export interface Frequencies {
  RED: number;
  BLACK: number;
  WHITE: number;
}

export interface Streak {
  color: string;
  count: number;
}

export interface Suggestion {
  type: "ALERT" | "INFO" | "WARNING";
  message: string;
  confidence: number;
  kelly_fraction: number;
}

export interface Calibration {
  method: string;
  probability_calibrated: number;
  sample_support: number;
  is_calibrated: boolean;
}

export interface ModelVote {
  model: string;
  color: string;
  probability: number;
  support: number;
}

export interface PredictionStats {
  total: number;
  settled: number;
  pending: number;
  hits: number;
  misses: number;
  voids: number;
  hit_rate: number;
  last_100_hit_rate: number;
  by_decision: Record<string, {
    total: number;
    settled: number;
    hits: number;
    hit_rate: number;
  }>;
  confidence_buckets: Record<string, {
    total: number;
    settled: number;
    hits: number;
    hit_rate: number;
  }>;
}

export interface AnalysisData {
  model_version: string;
  analysis_status: "OK" | "DEGRADED";
  frequencies: Frequencies;
  probabilities: Frequencies;
  decision: "BET_RED" | "BET_BLACK" | "BET_WHITE" | "NO_BET";
  white_gap: number;
  current_streak: Streak;
  suggestion: Suggestion;
  last_white_timestamp: string | null;
  total_analyzed: number;
  market_state: string;
  quantum_score: number;
  entropy: number;
  calibration: Calibration;
  model_votes: ModelVote[];
  reason_codes: string[];
  seed_integrity: {
    status: string;
    score: number;
    message: string;
  };
  based_on_latest_roll?: string;
  analysis_generated_at?: string;
}

export interface AnalysisResponse {
  data: AnalysisData | null;
  prediction_stats?: PredictionStats;
  warning?: string;
  error?: string;
  cache?: "HIT" | "MISS";
}

// ============================================================
// FUNÇÕES DE FETCH
// ============================================================

/**
 * Busca o histórico de rodadas do backend.
 * @param limit Número de registros (padrão: 100)
 * @param offset Offset para paginação (padrão: 0)
 */
export async function fetchHistory(
  limit = 100,
  offset = 0
): Promise<HistoryResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/history?limit=${limit}&offset=${offset}`,
    {
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Erro ao buscar histórico: ${res.status}`);
  }

  return res.json();
}

/**
 * Busca a análise estatística do microsserviço Python (via backend).
 */
export async function fetchAnalysis(): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE_URL}/api/analysis`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Erro ao buscar análise: ${res.status}`);
  }

  return res.json();
}
