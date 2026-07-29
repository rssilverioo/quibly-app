import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { OpenaiModule } from '../openai/openai.module';
import { GenerateModule } from '../generate/generate.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  // Storage, Gemini and Prisma are @Global; Openai, Generate and Analytics are not.
  imports: [OpenaiModule, GenerateModule, AnalyticsModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
