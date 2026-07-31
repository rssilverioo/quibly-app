import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { FeedModule } from '../feed/feed.module';
import { LeaguesModule } from '../leagues/leagues.module';

@Module({
  imports: [FeedModule, LeaguesModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
