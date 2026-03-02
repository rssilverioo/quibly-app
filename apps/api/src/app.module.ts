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
import { GeminiModule } from './gemini/gemini.module';
import { ImageSearchModule } from './image-search/image-search.module';
import { DocumentsModule } from './documents/documents.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { UsageModule } from './usage/usage.module';
import { GenerateModule } from './generate/generate.module';
import { StripeModule } from './stripe/stripe.module';
import { AdminModule } from './admin/admin.module';
import { GamificationModule } from './gamification/gamification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    FirebaseModule,
    StorageModule,
    GeminiModule,
    ImageSearchModule,
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
    DocumentsModule,
    FlashcardsModule,
    QuizzesModule,
    UsageModule,
    GenerateModule,
    StripeModule,
    AdminModule,
    GamificationModule,
  ],
})
export class AppModule {}
