import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionsSweeper } from './sessions.sweeper';
import { AchievementsModule } from '../achievements/achievements.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [AchievementsModule, AnalyticsModule, EntitlementsModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsSweeper],
  exports: [SessionsService],
})
export class SessionsModule {}
