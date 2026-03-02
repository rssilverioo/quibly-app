import { Controller, Get, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsageService } from './usage.service';

@Controller('usage')
@UseGuards(FirebaseAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  getUsage(@CurrentUser() user: { userId: string }) {
    return this.usageService.getUsage(user.userId);
  }
}
