import { Module } from '@nestjs/common';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  // EntitlementsModule is @Global(), so this import is only here to document
  // the dependency — Nest resolves it either way.
  imports: [EntitlementsModule],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
