import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PredictionsService } from '../predictions/predictions.service';
import { PrismaService } from '../prisma/prisma.service';

const BLAZE_COLOR_MAP: Record<number, 'RED' | 'BLACK' | 'WHITE'> = {
  0: 'WHITE',
  1: 'RED',
  2: 'BLACK',
};

type RawRecord = Record<string, unknown>;

interface ParsedRoll {
  external_id: string | null;
  source: string;
  color: 'RED' | 'BLACK' | 'WHITE';
  roll_value: number;
  timestamp: Date;
  hash: string | null;
  server_seed: string | null;
  seed_hash: string | null;
  round_status: string | null;
  sequence_number: number | null;
  raw_payload: RawRecord;
}

@Injectable()
export class CollectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollectorService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private readonly blazeApiUrl: string;
  private readonly intervalMs: number;
  private readonly source: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly predictionsService: PredictionsService,
  ) {
    this.blazeApiUrl =
      process.env.BLAZE_API_URL || 'http://localhost:3001/blaze/history';
    this.intervalMs = parseInt(
      process.env.COLLECTOR_INTERVAL_MS || '30000',
      10,
    );
    this.source =
      process.env.COLLECTOR_SOURCE ||
      (this.blazeApiUrl.includes('localhost') ? 'mock' : 'blaze');
  }

  onModuleInit() {
    this.logger.log(
      `Iniciando coleta a cada ${this.intervalMs / 1000}s de: ${this.blazeApiUrl}`,
    );
    setTimeout(() => {
      void this.collectData();
      this.intervalId = setInterval(() => {
        void this.collectData();
      }, this.intervalMs);
    }, 5000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.logger.log('Coleta de dados encerrada');
    }
  }

  private async collectData(): Promise<void> {
    try {
      const response = await axios.get<unknown>(this.blazeApiUrl, {
        timeout: 15000,
      });
      const rolls = this.parseResponse(response.data);

      if (rolls.length === 0) {
        this.logger.debug('Nenhuma rodada nova para processar');
        return;
      }

      let newCount = 0;

      for (const roll of rolls) {
        try {
          if (!this.isValidRoll(roll)) continue;

          const existing = await this.findExistingRoll(roll);
          if (existing) continue;

          await this.prisma.roll.create({
            data: {
              external_id: roll.external_id || undefined,
              source: roll.source,
              color: roll.color,
              roll_value: roll.roll_value,
              timestamp: roll.timestamp,
              hash: roll.hash || roll.server_seed || undefined,
              server_seed: roll.server_seed || undefined,
              seed_hash: roll.seed_hash || undefined,
              round_status: roll.round_status || undefined,
              sequence_number: roll.sequence_number || undefined,
              raw_payload: this.toJson(roll.raw_payload),
            },
          });
          newCount++;
        } catch (error: unknown) {
          if (!this.isPrismaDuplicate(error)) {
            this.logger.warn(
              `Erro ao salvar rodada: ${this.errorMessage(error)}`,
            );
          }
        }
      }

      if (newCount > 0) {
        this.logger.log(
          `${newCount} novas rodadas salvas (de ${rolls.length} recebidas)`,
        );
        await this.predictionsService.reconcilePending();
      }
    } catch (error: unknown) {
      this.logger.error(`Erro na coleta: ${this.errorMessage(error)}`);
    }
  }

  private parseResponse(data: unknown): ParsedRoll[] {
    if (this.isRecord(data) && Array.isArray(data.records)) {
      this.logger.debug(
        `Formato detectado: API Real da Blaze (${data.records.length} records)`,
      );
      return data.records
        .filter((record): record is RawRecord => this.isRecord(record))
        .map((record) => this.parseBlazeRecord(record));
    }

    if (Array.isArray(data)) {
      this.logger.debug(
        `Formato detectado: Mock interno (${data.length} rolls)`,
      );
      return data
        .filter((record): record is RawRecord => this.isRecord(record))
        .map((record) => this.parseMockRecord(record));
    }

    this.logger.warn(
      `Formato de resposta nao reconhecido: ${JSON.stringify(data).substring(0, 200)}`,
    );
    return [];
  }

  private parseBlazeRecord(record: RawRecord): ParsedRoll {
    const colorCode = this.readNumber(record.color);
    return {
      external_id: this.readString(record.id),
      source: this.source,
      color: BLAZE_COLOR_MAP[colorCode ?? -1] || 'RED',
      roll_value: this.readNumber(record.roll) ?? 0,
      timestamp: new Date(this.readString(record.created_at) || Date.now()),
      hash: this.readString(record.hash),
      server_seed: this.readString(record.server_seed),
      seed_hash: this.readString(record.server_seed_hash),
      round_status: this.readString(record.status),
      sequence_number: this.readNumber(record.nonce),
      raw_payload: record,
    };
  }

  private parseMockRecord(record: RawRecord): ParsedRoll {
    return {
      external_id: this.readString(record.id),
      source: this.source,
      color: this.normalizeColor(this.readString(record.color)),
      roll_value: this.readNumber(record.roll_value) ?? 0,
      timestamp: new Date(this.readString(record.timestamp) || Date.now()),
      hash: this.readString(record.hash),
      server_seed: this.readString(record.server_seed),
      seed_hash: this.readString(record.seed_hash),
      round_status: this.readString(record.status),
      sequence_number: this.readNumber(record.sequence_number),
      raw_payload: record,
    };
  }

  private async findExistingRoll(roll: ParsedRoll) {
    if (roll.external_id) {
      const existingByExternalId = await this.prisma.roll.findUnique({
        where: {
          source_external_id: {
            source: roll.source,
            external_id: roll.external_id,
          },
        },
      });
      if (existingByExternalId) return existingByExternalId;
    }

    const hashToCheck = roll.hash || roll.server_seed;
    if (!hashToCheck) return null;

    return this.prisma.roll.findUnique({
      where: { hash: hashToCheck },
    });
  }

  private isValidRoll(roll: ParsedRoll): boolean {
    if (Number.isNaN(roll.timestamp.getTime())) {
      this.logger.warn('Rodada ignorada: timestamp invalido');
      return false;
    }

    const colorMatchesValue =
      (roll.color === 'WHITE' && roll.roll_value === 0) ||
      (roll.color === 'RED' && roll.roll_value >= 1 && roll.roll_value <= 7) ||
      (roll.color === 'BLACK' && roll.roll_value >= 8 && roll.roll_value <= 14);

    if (!colorMatchesValue) {
      this.logger.warn(
        `Rodada ignorada: cor/numero inconsistente (${roll.color}/${roll.roll_value})`,
      );
      return false;
    }

    return true;
  }

  private normalizeColor(color: string | null): 'RED' | 'BLACK' | 'WHITE' {
    if (color === 'BLACK' || color === 'WHITE') return color;
    return 'RED';
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private isRecord(value: unknown): value is RawRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isPrismaDuplicate(error: unknown): boolean {
    return (
      this.isRecord(error) &&
      typeof error.code === 'string' &&
      error.code === 'P2002'
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
