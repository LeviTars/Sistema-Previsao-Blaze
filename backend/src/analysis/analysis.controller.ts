import { Controller, Get } from '@nestjs/common';
import { AnalysisService, type AnalysisResult } from './analysis.service';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionsService } from '../predictions/predictions.service';

@Controller('api/analysis')
export class AnalysisController {
  private cachedLatestRollId: string | null = null;
  private cachedAnalysis: AnalysisResult | null = null;

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly prisma: PrismaService,
    private readonly predictionsService: PredictionsService,
  ) {}

  @Get()
  async getAnalysis() {
    await this.predictionsService.reconcilePending();

    const rolls = await this.prisma.roll.findMany({
      orderBy: { timestamp: 'desc' },
      take: 1000,
      select: {
        id: true,
        color: true,
        roll_value: true,
        timestamp: true,
        server_seed: true,
        hash: true,
      },
    });

    const predictionStats = await this.predictionsService.getStats(500);

    if (rolls.length === 0) {
      return {
        error: 'Nenhum dado disponivel para analise',
        data: null,
        prediction_stats: predictionStats,
      };
    }

    const latestRoll = rolls[0];

    if (
      this.cachedAnalysis &&
      this.cachedLatestRollId &&
      this.cachedLatestRollId === latestRoll.id
    ) {
      return {
        data: this.cachedAnalysis,
        prediction_stats: predictionStats,
        cache: 'HIT',
      };
    }

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
      const fallback = this.createFallbackAnalysis(rolls);
      this.cachedLatestRollId = latestRoll.id;
      this.cachedAnalysis = fallback;

      return {
        warning:
          'Microsservico de analise indisponivel. Nenhum sinal operacional foi emitido.',
        data: fallback,
        prediction_stats: predictionStats,
      };
    }

    const enrichedAnalysis: AnalysisResult = {
      ...analysis,
      based_on_latest_roll: latestRoll.id,
      analysis_generated_at: new Date().toISOString(),
    };

    await this.predictionsService.registerFromAnalysis(
      { id: latestRoll.id, timestamp: latestRoll.timestamp },
      enrichedAnalysis,
    );

    this.cachedLatestRollId = latestRoll.id;
    this.cachedAnalysis = enrichedAnalysis;

    return {
      data: enrichedAnalysis,
      prediction_stats: await this.predictionsService.getStats(500),
      cache: 'MISS',
    };
  }

  private createFallbackAnalysis(
    rolls: { id: string; color: string; roll_value: number; timestamp: Date }[],
  ): AnalysisResult {
    const latestRoll = rolls[0];

    return {
      model_version: 'fallback-basic-v1',
      analysis_status: 'DEGRADED',
      frequencies: this.calculateBasicFrequencies(rolls),
      probabilities: { RED: 46.67, BLACK: 46.67, WHITE: 6.67 },
      decision: 'NO_BET',
      white_gap: this.calculateWhiteGap(rolls),
      current_streak: this.calculateCurrentStreak(rolls),
      suggestion: {
        type: 'INFO',
        message: 'Motor preditivo offline. Sem entrada ate a analise voltar.',
        confidence: 0,
        kelly_fraction: 0,
      },
      last_white_timestamp:
        rolls.find((roll) => roll.color === 'WHITE')?.timestamp.toISOString() ??
        null,
      total_analyzed: rolls.length,
      market_state: 'UNKNOWN',
      quantum_score: 0,
      entropy: 0,
      calibration: {
        method: 'none',
        probability_calibrated: 0,
        sample_support: 0,
        is_calibrated: false,
      },
      model_votes: [],
      reason_codes: ['ANALYSIS_SERVICE_OFFLINE'],
      seed_integrity: {
        status: 'UNKNOWN',
        score: 0,
        message: 'Auditoria indisponivel durante fallback.',
      },
      based_on_latest_roll: latestRoll.id,
      analysis_generated_at: new Date().toISOString(),
    };
  }

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

  private calculateWhiteGap(rolls: { color: string }[]) {
    const index = rolls.findIndex((roll) => roll.color === 'WHITE');
    return index >= 0 ? index : rolls.length;
  }

  private calculateCurrentStreak(rolls: { color: string }[]) {
    const color = rolls[0]?.color ?? 'NONE';
    let count = 0;

    for (const roll of rolls) {
      if (roll.color !== color) break;
      count++;
    }

    return { color, count };
  }
}
