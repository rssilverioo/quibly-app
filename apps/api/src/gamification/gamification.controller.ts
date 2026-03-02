import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GamificationService } from './gamification.service';
import { AwardXpDto } from './dto/award-xp.dto';

@Controller('gamification')
@UseGuards(FirebaseAuthGuard)
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Post('xp')
  awardXp(
    @CurrentUser() user: { userId: string },
    @Body() dto: AwardXpDto,
  ) {
    return this.gamificationService.awardXp(user.userId, dto.action);
  }
}
