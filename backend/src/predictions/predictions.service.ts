import { Injectable, Logger } from '@nestjs/common';
import {
  Color,
  PredictionDecision,
  PredictionOutcome,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalysisResult } from '../analysis/analysis.service';

type RollBase = {
  id: string;
  timestamp: Date;
};

type StatsPrediction = {
  outcome: PredictionOutcome;
  decision: PredictionDecision;
  confidence_raw: number;
};

export interface PredictionStats {
  total: number;
  settled: number;
  pending: number;
  hits: number;
  misses: number;
  voids: number;
  hit_rate: number;
  last_100_hit_rate: number;
  by_decision: Record<
    string,
    {
      total: number;
      settled: number;
      hits: number;
      hit_rate: number;
    }
  >;
  confidence_buckets: Record<
    string,
    {
      total: number;
      settled: number;
      hits: number;
      hit_rate: number;
    }
  >;
}

@Injectable()
export class PredictionsService {
  private readonly logger = new Logger(PredictionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerFromAnalysis(
    baseRoll: RollBase,
    analysis: AnalysisResult,
  ): Promise<void> {
    const decision = this.normalizeDecision(analysis.decision);
    const predictedColor = this.colorFromDecision(decision);
    const probabilities = analysis.probabilities ?? {
      RED: 0,
      BLACK: 0,
      WHITE: 0,
    };

    try {
      await this.prisma.prediction.upsert({
        where: {
          model_version_base_roll_id: {
            model_version: analysis.model_version || 'analysis-v1',
            base_roll_id: baseRoll.id,
          },
        },
        create: {
          model_version: analysis.model_version || 'analysis-v1',
          base_roll_id: baseRoll.id,
          predicted_color: predictedColor,
          prob_red: probabilities.RED,
          prob_black: probabilities.BLACK,
          prob_white: probabilities.WHITE,
          confidence_raw: analysis.suggestion?.confidence ?? 0,
          confidence_calibrated:
            analysis.calibration?.probability_calibrated ?? null,
          decision,
          reason_codes: this.toJson(analysis.reason_codes ?? []),
          model_votes: this.toJson(analysis.model_votes ?? []),
        },
        update: {
          predicted_color: predictedColor,
          prob_red: probabilities.RED,
          prob_black: probabilities.BLACK,
          prob_white: probabilities.WHITE,
          confidence_raw: analysis.suggestion?.confidence ?? 0,
          confidence_calibrated:
            analysis.calibration?.probability_calibrated ?? null,
          decision,
          reason_codes: this.toJson(analysis.reason_codes ?? []),
          model_votes: this.toJson(analysis.model_votes ?? []),
        },
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Falha ao registrar previsao: ${this.errorMessage(error)}`,
      );
    }
  }

  async reconcilePending(): Promise<number> {
    const pending = await this.prisma.prediction.findMany({
      where: { outcome: PredictionOutcome.PENDING },
      include: { base_roll: true },
      orderBy: { created_at: 'asc' },
      take: 200,
    });

    let settled = 0;

    for (const prediction of pending) {
      const targetRoll = await this.prisma.roll.findFirst({
        where: {
          timestamp: { gt: prediction.base_roll.timestamp },
        },
        orderBy: { timestamp: 'asc' },
      });

      if (!targetRoll) continue;

      const outcome =
        prediction.decision === PredictionDecision.NO_BET ||
        !prediction.predicted_color
          ? PredictionOutcome.VOID
          : prediction.predicted_color === targetRoll.color
            ? PredictionOutcome.HIT
            : PredictionOutcome.MISS;

      await this.prisma.prediction.update({
        where: { id: prediction.id },
        data: {
          target_roll_id: targetRoll.id,
          result_color: targetRoll.color,
          outcome,
          settled_at: new Date(),
        },
      });
      settled++;
    }

    if (settled > 0) {
      this.logger.log(`${settled} previsoes reconciliadas`);
    }

    return settled;
  }

  async getStats(limit = 500): Promise<PredictionStats> {
    const predictions = await this.prisma.prediction.findMany({
      orderBy: { created_at: 'desc' },
      take: Math.min(Math.max(limit, 1), 5000),
    });

    return this.buildStats(predictions);
  }

  async getRecent(limit = 100) {
    return this.prisma.prediction.findMany({
      orderBy: { created_at: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      include: {
        base_roll: true,
        target_roll: true,
      },
    });
  }

  private buildStats(predictions: StatsPrediction[]) {
    const barePredictions = predictions.map((prediction) => ({
      outcome: prediction.outcome,
      decision: prediction.decision,
      confidence_raw: prediction.confidence_raw,
    }));

    const settledPredictions = barePredictions.filter(
      (prediction) =>
        prediction.outcome === PredictionOutcome.HIT ||
        prediction.outcome === PredictionOutcome.MISS,
    );
    const hits = settledPredictions.filter(
      (prediction) => prediction.outcome === PredictionOutcome.HIT,
    ).length;
    const misses = settledPredictions.length - hits;
    const voids = barePredictions.filter(
      (prediction) => prediction.outcome === PredictionOutcome.VOID,
    ).length;
    const pending = barePredictions.filter(
      (prediction) => prediction.outcome === PredictionOutcome.PENDING,
    ).length;

    const last100 = settledPredictions.slice(0, 100);
    const last100Hits = last100.filter(
      (prediction) => prediction.outcome === PredictionOutcome.HIT,
    ).length;

    return {
      total: barePredictions.length,
      settled: settledPredictions.length,
      pending,
      hits,
      misses,
      voids,
      hit_rate: this.rate(hits, settledPredictions.length),
      last_100_hit_rate: this.rate(last100Hits, last100.length),
      by_decision: this.groupStats(barePredictions, (prediction) =>
        String(prediction.decision),
      ),
      confidence_buckets: this.groupStats(barePredictions, (prediction) =>
        this.confidenceBucket(prediction.confidence_raw),
      ),
    };
  }

  private groupStats<T extends { outcome: PredictionOutcome }>(
    rows: T[],
    keyGetter: (row: T) => string,
  ) {
    const grouped: PredictionStats['by_decision'] = {};

    for (const row of rows) {
      const key = keyGetter(row);
      grouped[key] ??= { total: 0, settled: 0, hits: 0, hit_rate: 0 };
      grouped[key].total++;

      if (
        row.outcome === PredictionOutcome.HIT ||
        row.outcome === PredictionOutcome.MISS
      ) {
        grouped[key].settled++;
      }

      if (row.outcome === PredictionOutcome.HIT) {
        grouped[key].hits++;
      }
    }

    for (const key of Object.keys(grouped)) {
      grouped[key].hit_rate = this.rate(
        grouped[key].hits,
        grouped[key].settled,
      );
    }

    return grouped;
  }

  private confidenceBucket(confidence: number): string {
    if (confidence < 50) return '0-49';
    if (confidence < 60) return '50-59';
    if (confidence < 70) return '60-69';
    if (confidence < 80) return '70-79';
    if (confidence < 90) return '80-89';
    return '90-100';
  }

  private rate(value: number, total: number): number {
    return total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
  }

  private normalizeDecision(decision?: string): PredictionDecision {
    if (decision === 'BET_RED') return PredictionDecision.BET_RED;
    if (decision === 'BET_BLACK') return PredictionDecision.BET_BLACK;
    if (decision === 'BET_WHITE') return PredictionDecision.BET_WHITE;
    return PredictionDecision.NO_BET;
  }

  private colorFromDecision(decision: PredictionDecision): Color | null {
    if (decision === PredictionDecision.BET_RED) return Color.RED;
    if (decision === PredictionDecision.BET_BLACK) return Color.BLACK;
    if (decision === PredictionDecision.BET_WHITE) return Color.WHITE;
    return null;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
