import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { FirebaseModule } from './firebase/firebase.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubjectsModule } from './subjects/subjects.module';
import { SessionsModule } from './sessions/sessions.module';
import { ProofChecksModule } from './proof-checks/proof-checks.module';
import { LeaguesModule } from './leagues/leagues.module';
import { FeedModule } from './feed/feed.module';
import { ChatModule } from './chat/chat.module';
import { AchievementsModule } from './achievements/achievements.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    FirebaseModule,
    StorageModule,
    AuthModule,
    UsersModule,
    SubjectsModule,
    SessionsModule,
    ProofChecksModule,
    LeaguesModule,
    FeedModule,
    ChatModule,
    AchievementsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
