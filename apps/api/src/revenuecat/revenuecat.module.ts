import { Module } from '@nestjs/common';
import { RevenueCatController } from './revenuecat.controller';
import { RevenueCatService } from './revenuecat.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  controllers: [RevenueCatController],
  providers: [RevenueCatService],
  exports: [RevenueCatService],
})
export class RevenueCatModule {}
