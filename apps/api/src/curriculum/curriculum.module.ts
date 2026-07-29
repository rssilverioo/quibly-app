import { Module } from '@nestjs/common';
import { CurriculumController, UserTrackController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';

@Module({
  controllers: [CurriculumController, UserTrackController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
