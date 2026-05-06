import { Controller, Get, Query } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// MOCK CONTROLLER - Simula a API da Blaze
// ============================================================
// Este controller gera dados aleatórios para simular os resultados
// do jogo Double da Blaze. Quando for integrar com a API real,
// substitua as chamadas a este endpoint pela URL real da Blaze.
//
// API Real da Blaze (exemplo):
//   GET https://blaze.com/api/roulette_games/recent
//
// A resposta da API real pode ter um formato diferente.
// Adapte o CollectorService para o formato correto.
// ============================================================

interface MockRoll {
  id: string;
  color: 'RED' | 'BLACK' | 'WHITE';
  roll_value: number;
  timestamp: string;
  hash: string;
  server_seed: string | null;
}

@Controller('blaze')
export class MockController {
  /**
   * GET /blaze/history
   * Simula o endpoint da API da Blaze retornando dados aleatórios.
   *
   * @param count - Quantidade de resultados a gerar (padrão: 15)
   */
  @Get('history')
  getMockHistory(@Query('count') count?: string): MockRoll[] {
    const total = Math.min(parseInt(count || '15', 10), 100);
    const rolls: MockRoll[] = [];

    for (let i = 0; i < total; i++) {
      rolls.push(this.generateRandomRoll(i));
    }

    return rolls;
  }

  /**
   * Gera uma rodada aleatória respeitando as probabilidades reais do Double:
   * - RED: ~46.67% (números 1 a 7)
   * - BLACK: ~46.67% (números 8 a 14)
   * - WHITE: ~6.67% (número 0)
   */
  private generateRandomRoll(offsetMinutes: number): MockRoll {
    const rollValue = Math.floor(Math.random() * 15); // 0 a 14

    let color: 'RED' | 'BLACK' | 'WHITE';
    if (rollValue === 0) {
      color = 'WHITE';
    } else if (rollValue <= 7) {
      color = 'RED';
    } else {
      color = 'BLACK';
    }

    const timestamp = new Date(
      Date.now() - offsetMinutes * 30 * 1000, // Cada rodada ~30s atrás
    );

    return {
      id: uuidv4(),
      color,
      roll_value: rollValue,
      timestamp: timestamp.toISOString(),
      hash: uuidv4().replace(/-/g, ''), // Hash fictício
      server_seed: null,
    };
  }
}
