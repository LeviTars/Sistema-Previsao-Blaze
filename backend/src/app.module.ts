import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HistoryModule } from './history/history.module';
import { AnalysisModule } from './analysis/analysis.module';
import { CollectorModule } from './collector/collector.module';
import { MockModule } from './mock/mock.module';
import { PredictionsModule } from './predictions/predictions.module';

@Module({
  imports: [
    // Carrega variáveis de ambiente do .env
    ConfigModule.forRoot({ isGlobal: true }),
    // Módulos do sistema
    PrismaModule,
    HistoryModule,
    AnalysisModule,
    PredictionsModule,
    CollectorModule,
    MockModule,
  ],
})
export class AppModule {}
