import { Controller, Get, Query } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('api/history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  /**
   * GET /api/history
   * Retorna o histórico de rodadas do banco de dados.
   *
   * Query params:
   *   - limit: número de registros (padrão: 100, máx: 500)
   *   - offset: paginação (padrão: 0)
   */
  @Get()
  async getHistory(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = Math.min(parseInt(limit || '100', 10), 500);
    const parsedOffset = parseInt(offset || '0', 10);
    return this.historyService.getHistory(parsedLimit, parsedOffset);
  }
}
