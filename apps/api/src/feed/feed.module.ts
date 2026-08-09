import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { StorageModule } from '../storage/storage.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [ModerationModule, StorageModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
