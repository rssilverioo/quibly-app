import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { OpenaiModule } from '../openai/openai.module';
import { GenerateModule } from '../generate/generate.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AiRouterModule } from '../ai-router/ai-router.module';

@Module({
  // Storage, Gemini and Prisma are @Global; Openai, Generate, Analytics and
  // AiRouter are not.
  imports: [OpenaiModule, GenerateModule, AnalyticsModule, AiRouterModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
