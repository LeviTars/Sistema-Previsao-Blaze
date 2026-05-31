import { Module } from '@nestjs/common';
import { CollectorService } from './collector.service';
import { PredictionsModule } from '../predictions/predictions.module';

@Module({
  imports: [PredictionsModule],
  providers: [CollectorService],
})
export class CollectorModule {}
