import { Controller, Get, Query } from '@nestjs/common';
import { PredictionsService } from './predictions.service';

@Controller('api/predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Get()
  async getRecent(@Query('limit') limit?: string) {
    return {
      data: await this.predictionsService.getRecent(
        parseInt(limit || '100', 10),
      ),
    };
  }

  @Get('stats')
  async getStats(@Query('limit') limit?: string) {
    return {
      data: await this.predictionsService.getStats(
        parseInt(limit || '500', 10),
      ),
    };
  }
}
