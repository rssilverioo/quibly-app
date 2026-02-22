import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('achievements')
@UseGuards(FirebaseAuthGuard)
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  getAll(@CurrentUser() user: { userId: string }) {
    return this.achievementsService.getAllAchievements(user.userId);
  }

  @Get('unlocked')
  getUnlocked(@CurrentUser() user: { userId: string }) {
    return this.achievementsService.getUserAchievements(user.userId);
  }

  @Post('seed')
  seed() {
    return this.achievementsService.seedAchievements();
  }
}
