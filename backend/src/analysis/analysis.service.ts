import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface RollData {
  color: string;
  roll_value: number;
  timestamp: string;
  server_seed: string | null;
  hash: string | null;
}

export interface AnalysisResult {
  model_version: string;
  analysis_status: 'OK' | 'DEGRADED';
  frequencies: {
    RED: number;
    BLACK: number;
    WHITE: number;
  };
  probabilities: {
    RED: number;
    BLACK: number;
    WHITE: number;
  };
  decision: 'BET_RED' | 'BET_BLACK' | 'BET_WHITE' | 'NO_BET';
  white_gap: number;
  current_streak: {
    color: string;
    count: number;
  };
  suggestion: {
    type: 'ALERT' | 'INFO' | 'WARNING';
    message: string;
    confidence: number;
    kelly_fraction: number;
  };
  last_white_timestamp: string | null;
  total_analyzed: number;
  market_state: string;
  quantum_score: number;
  entropy: number;
  calibration: {
    method: string;
    probability_calibrated: number;
    sample_support: number;
    is_calibrated: boolean;
  };
  model_votes: Array<{
    model: string;
    color: string;
    probability: number;
    support: number;
  }>;
  reason_codes: string[];
  seed_integrity: {
    status: 'OPTIMAL' | 'RECYCLED' | 'BROKEN' | 'UNKNOWN';
    score: number;
    message: string;
  };
  based_on_latest_roll?: string;
  analysis_generated_at?: string;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly analysisUrl: string;

  constructor() {
    this.analysisUrl =
      process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8000';
  }

  async getAnalysis(rolls: RollData[]): Promise<AnalysisResult | null> {
    try {
      const response = await axios.post<AnalysisResult>(
        `${this.analysisUrl}/predict`,
        { rolls },
        { timeout: 10000 },
      );

      this.logger.log(
        `Analise recebida: ${response.data.total_analyzed} rodadas analisadas`,
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(
        `Erro ao comunicar com microsservico Python: ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
