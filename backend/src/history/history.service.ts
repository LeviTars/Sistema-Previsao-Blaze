import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca o histórico de rodadas do banco de dados, ordenado
   * do mais recente para o mais antigo.
   */
  async getHistory(limit: number, offset: number) {
    const [rolls, total] = await Promise.all([
      this.prisma.roll.findMany({
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.roll.count(),
    ]);

    return {
      data: rolls,
      total,
      limit,
      offset,
    };
  }
}
