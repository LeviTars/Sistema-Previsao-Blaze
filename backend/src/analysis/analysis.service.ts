import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

// ============================================================
// ANALYSIS SERVICE - Comunicação com o Microsserviço Python
// ============================================================
// Envia os últimos resultados para o FastAPI para análise
// estatística e recebe as métricas calculadas.
// ============================================================

export interface RollData {
  color: string;
  roll_value: number;
  timestamp: string;
  server_seed: string | null;
  hash: string | null;
}

export interface AnalysisResult {
  frequencies: {
    RED: number;
    BLACK: number;
    WHITE: number;
  };
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
  seed_integrity: {
    status: 'OPTIMAL' | 'RECYCLED' | 'BROKEN';
    score: number;
    message: string;
  };
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly analysisUrl: string;

  constructor() {
    this.analysisUrl =
      process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8000';
  }

  /**
   * Envia os dados para o microsserviço Python e retorna a análise.
   * Em caso de erro, retorna null (o frontend lida com a ausência).
   */
  async getAnalysis(rolls: RollData[]): Promise<AnalysisResult | null> {
    try {
      const response = await axios.post<AnalysisResult>(
        `${this.analysisUrl}/predict`,
        { rolls },
        { timeout: 10000 }, // Timeout de 10s
      );

      this.logger.log(
        `Análise recebida: ${response.data.total_analyzed} rodadas analisadas`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao comunicar com microsserviço Python: ${error.message}`,
      );
      return null;
    }
  }
}
