import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  // EntitlementsModule is @Global(); imported here anyway to document the
  // dependency the entitlements admin routes have on it.
  imports: [EntitlementsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
