import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';

@Controller('rooms')
@UseGuards(FirebaseAuthGuard)
export class RoomChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Post(':id/challenges')
  create(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id') roomId: string,
    @Body() dto: CreateChallengeDto,
  ) {
    return this.challengesService.create(roomId, user.userId, dto);
  }
}
