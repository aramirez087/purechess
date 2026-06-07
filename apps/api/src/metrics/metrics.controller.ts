import { Controller, Get } from '@nestjs/common';
import { MetricsService, MetricsSnapshot } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  getMetrics(): MetricsSnapshot {
    return this.metrics.getSnapshot();
  }
}
