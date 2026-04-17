import { Module } from '@nestjs/common';
import { AudioSessionsController } from './audio-sessions.controller';
import { AudioSessionsService } from './audio-sessions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GeminiModule } from '../gemini/gemini.module';
import { OpenaiModule } from '../openai/openai.module';
import { StorageModule } from '../storage/storage.module';
import { UsageModule } from '../usage/usage.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    GeminiModule,
    OpenaiModule,
    StorageModule,
    UsageModule,
    SessionsModule,
    AuthModule,
  ],
  controllers: [AudioSessionsController],
  providers: [AudioSessionsService],
})
export class AudioSessionsModule {}
