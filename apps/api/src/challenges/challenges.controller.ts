import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { ChallengesService } from './challenges.service';
import { FeedService } from '../feed/feed.service';

@Controller('challenges')
@UseGuards(FirebaseAuthGuard)
export class ChallengesController {
  constructor(
    private readonly challengesService: ChallengesService,
    private readonly feedService: FeedService,
  ) {}

  @Get(':id/leaderboard')
  leaderboard(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id') challengeId: string,
    @Query('page') rawPage = '1',
    @Query('limit') rawLimit = '20',
  ) {
    const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(rawLimit, 10) || 20));
    return this.challengesService.leaderboard(
      challengeId,
      user.userId,
      page,
      limit,
    );
  }

  @Get(':challengeId/members/:userId/posts')
  memberPosts(
    @CurrentUser() user: { userId: string; email: string },
    @Param('challengeId') challengeId: string,
    @Param('userId') memberUserId: string,
    @Query('page') rawPage = '1',
    @Query('limit') rawLimit = '20',
  ) {
    const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(rawLimit, 10) || 20));
    return this.feedService.getChallengeMemberPosts(
      challengeId,
      user.userId,
      memberUserId,
      page,
      limit,
    );
  }
}
