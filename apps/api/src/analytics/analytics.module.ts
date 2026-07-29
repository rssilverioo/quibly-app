import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

/**
 * Not registered as @Global — imported directly by the modules that own a
 * server-sourced event (sessions, lessons, revenuecat) so this Fase 0 change
 * doesn't need to touch app.module.ts, which another squad owns right now.
 */
@Module({
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
