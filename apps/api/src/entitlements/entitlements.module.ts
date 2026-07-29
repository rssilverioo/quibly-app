import { Global, Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

// Global: UsageService, AiRouterService, GenerateService and the admin
// module all need plan limits, and none of them should have to remember to
// import this explicitly.
@Global()
@Module({
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
