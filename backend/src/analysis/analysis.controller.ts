import { Controller, Get } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/analysis
   * Busca os últimos 200 resultados do banco e envia para
   * o microsserviço Python, retornando as métricas calculadas.
   */
  @Get()
  async getAnalysis() {
    // Buscar últimos 1.000 resultados para treino da IA
    const rolls = await this.prisma.roll.findMany({
      orderBy: { timestamp: 'desc' },
      take: 1000,
      select: {
        color: true,
        roll_value: true,
        timestamp: true,
        server_seed: true,
        hash: true,
      },
    });

    if (rolls.length === 0) {
      return {
        error: 'Nenhum dado disponível para análise',
        data: null,
      };
    }

    // Enviar para o microsserviço Python
    const analysis = await this.analysisService.getAnalysis(
      rolls.map((r) => ({
        color: r.color,
        roll_value: r.roll_value,
        timestamp: r.timestamp.toISOString(),
        server_seed: r.server_seed,
        hash: r.hash,
      })),
    );

    if (!analysis) {
      // Fallback: se o Python estiver offline, retorna dados básicos com estrutura completa
      return {
        warning: 'Microsserviço de análise indisponível. Dados básicos retornados.',
        data: {
          frequencies: this.calculateBasicFrequencies(rolls),
          white_gap: 0,
          current_streak: { color: rolls[0].color, count: 1 },
          suggestion: {
            type: 'INFO',
            message: '⌛ Conectando ao motor de inteligência quântica...',
            confidence: 0,
          },
          last_white_timestamp: null,
          total_analyzed: rolls.length,
          market_state: 'UNKNOWN',
          quantum_score: 0,
          entropy: 0,
        },
      };
    }

    return { data: analysis };
  }

  /**
   * Cálculo básico de frequência como fallback quando o Python está offline.
   */
  private calculateBasicFrequencies(
    rolls: { color: string; roll_value: number; timestamp: Date }[],
  ) {
    const total = rolls.length;
    const counts = { RED: 0, BLACK: 0, WHITE: 0 };

    for (const roll of rolls) {
      counts[roll.color as keyof typeof counts]++;
    }

    return {
      RED: Number(((counts.RED / total) * 100).toFixed(1)),
      BLACK: Number(((counts.BLACK / total) * 100).toFixed(1)),
      WHITE: Number(((counts.WHITE / total) * 100).toFixed(1)),
    };
  }
}
