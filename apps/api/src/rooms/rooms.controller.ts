import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FeedService } from '../feed/feed.service';
import { RoomsService } from './rooms.service';

@Controller('rooms')
@UseGuards(FirebaseAuthGuard)
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly feedService: FeedService,
  ) {}

  @Get()
  list(@CurrentUser() user: { userId: string; email: string }) {
    return this.roomsService.listForUser(user.userId);
  }

  @Get(':id/feed')
  feed(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id') roomId: string,
    @Query('page') rawPage = '1',
    @Query('limit') rawLimit = '20',
  ) {
    const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(rawLimit, 10) || 20));
    return this.feedService.getLeagueFeed(roomId, user.userId, page, limit);
  }
}
