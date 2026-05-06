import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

// ============================================================
// COLLECTOR SERVICE - Worker de Coleta de Dados
// ============================================================
// Este serviço roda em background com setInterval, coletando
// dados da API da Blaze (ou do mock) e salvando no banco.
//
// FORMATO DA API REAL DA BLAZE:
//   URL: https://blaze.bet.br/api/singleplayer-originals/originals/roulette_games/recent/history/1?...
//   Response: { "records": [{ "id": "xxx", "created_at": "...", "color": 2, "roll": 13, "server_seed": "..." }] }
//   Cores numéricas: 0 = WHITE, 1 = RED, 2 = BLACK
//
// FORMATO DO MOCK (interno):
//   URL: http://localhost:3001/blaze/history
//   Response: [{ "id": "uuid", "color": "RED", "roll_value": 5, "timestamp": "...", "hash": "..." }]
//
// O collector detecta automaticamente qual formato está sendo usado.
// ============================================================

// Mapeamento de cor numérica da Blaze para o enum do sistema
const BLAZE_COLOR_MAP: Record<number, 'RED' | 'BLACK' | 'WHITE'> = {
  0: 'WHITE',
  1: 'RED',
  2: 'BLACK',
};

interface ParsedRoll {
  color: 'RED' | 'BLACK' | 'WHITE';
  roll_value: number;
  timestamp: Date;
  hash: string | null;
  server_seed: string | null;
}

@Injectable()
export class CollectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollectorService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private readonly blazeApiUrl: string;
  private readonly intervalMs: number;

  constructor(private readonly prisma: PrismaService) {
    this.blazeApiUrl =
      process.env.BLAZE_API_URL || 'http://localhost:3001/blaze/history';
    this.intervalMs = parseInt(
      process.env.COLLECTOR_INTERVAL_MS || '30000',
      10,
    );
  }

  onModuleInit() {
    this.logger.log(
      `🔄 Iniciando coleta a cada ${this.intervalMs / 1000}s de: ${this.blazeApiUrl}`,
    );
    // Aguarda 5 segundos para garantir que o servidor esteja pronto
    setTimeout(() => {
      this.collectData();
      this.intervalId = setInterval(() => this.collectData(), this.intervalMs);
    }, 5000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.logger.log('⏹ Coleta de dados encerrada');
    }
  }

  /**
   * Busca dados da API e salva no banco, sem duplicatas.
   */
  private async collectData(): Promise<void> {
    try {
      const response = await axios.get(this.blazeApiUrl, { timeout: 15000 });
      const rawData = response.data;

      // Detectar formato da resposta e parsear
      const rolls = this.parseResponse(rawData);

      if (!rolls || rolls.length === 0) {
        this.logger.debug('Nenhuma rodada nova para processar');
        return;
      }

      let newCount = 0;

      for (const roll of rolls) {
        try {
          // Verificar duplicata pelo hash ou pelo id (server_seed para a API real)
          const hashToCheck = roll.hash || roll.server_seed;
          if (hashToCheck) {
            const existing = await this.prisma.roll.findUnique({
              where: { hash: hashToCheck },
            });
            if (existing) continue;
          }

          await this.prisma.roll.create({
            data: {
              color: roll.color,
              roll_value: roll.roll_value,
              timestamp: roll.timestamp,
              hash: roll.hash || roll.server_seed || undefined,
              server_seed: roll.server_seed || undefined,
            },
          });
          newCount++;
        } catch (innerError: any) {
          // Ignora erros de duplicata (unique constraint violation)
          if (innerError.code !== 'P2002') {
            this.logger.warn(`Erro ao salvar rodada: ${innerError.message}`);
          }
        }
      }

      if (newCount > 0) {
        this.logger.log(
          `✅ ${newCount} novas rodadas salvas (de ${rolls.length} recebidas)`,
        );
      }
    } catch (error: any) {
      this.logger.error(`❌ Erro na coleta: ${error.message}`);
    }
  }

  /**
   * Detecta o formato da resposta e retorna um array normalizado de ParsedRoll.
   *
   * Suporta:
   * 1. API Real da Blaze: { records: [{ id, created_at, color (number), roll, server_seed }] }
   * 2. Mock interno: [{ id, color (string), roll_value, timestamp, hash, server_seed }]
   */
  private parseResponse(data: any): ParsedRoll[] {
    // Formato 1: API Real da Blaze (response.records é array)
    if (data && typeof data === 'object' && Array.isArray(data.records)) {
      this.logger.debug(`Formato detectado: API Real da Blaze (${data.records.length} records)`);
      return data.records.map((record: any) => ({
        color: BLAZE_COLOR_MAP[record.color] || 'RED',
        roll_value: record.roll ?? 0,
        timestamp: new Date(record.created_at || Date.now()),
        hash: record.server_seed || record.id || null,
        server_seed: record.server_seed || null,
      }));
    }

    // Formato 2: Mock interno (array direto)
    if (Array.isArray(data)) {
      this.logger.debug(`Formato detectado: Mock interno (${data.length} rolls)`);
      return data.map((roll: any) => ({
        color: roll.color as 'RED' | 'BLACK' | 'WHITE',
        roll_value: roll.roll_value ?? 0,
        timestamp: new Date(roll.timestamp || Date.now()),
        hash: roll.hash || null,
        server_seed: roll.server_seed || null,
      }));
    }

    this.logger.warn(
      `Formato de resposta não reconhecido: ${JSON.stringify(data).substring(0, 200)}`,
    );
    return [];
  }
}
