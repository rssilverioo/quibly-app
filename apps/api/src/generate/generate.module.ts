import { Module } from '@nestjs/common';
import { GenerateController } from './generate.controller';
import { GenerateService } from './generate.service';
import { UsageModule } from '../usage/usage.module';
import { AiRouterModule } from '../ai-router/ai-router.module';

@Module({
  imports: [UsageModule, AiRouterModule],
  controllers: [GenerateController],
  providers: [GenerateService],
  exports: [GenerateService],
})
export class GenerateModule {}
