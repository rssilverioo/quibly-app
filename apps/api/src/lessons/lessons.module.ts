import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { OpenaiModule } from '../openai/openai.module';
import { GenerateModule } from '../generate/generate.module';

@Module({
  // Storage, Gemini and Prisma are @Global; Openai and Generate are not.
  imports: [OpenaiModule, GenerateModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
