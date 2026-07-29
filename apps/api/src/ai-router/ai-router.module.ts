import { Module } from '@nestjs/common';
import { AiRouterService } from './ai-router.service';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  // EntitlementsModule and GeminiModule are both @Global(); imported here
  // anyway to document the dependency explicitly.
  imports: [EntitlementsModule, GeminiModule],
  providers: [AiRouterService],
  exports: [AiRouterService],
})
export class AiRouterModule {}
