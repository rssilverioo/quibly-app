import { Module } from '@nestjs/common';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { RoomChallengesController } from './room-challenges.controller';
import { FeedModule } from '../feed/feed.module';

@Module({
  imports: [FeedModule],
  controllers: [ChallengesController, RoomChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
