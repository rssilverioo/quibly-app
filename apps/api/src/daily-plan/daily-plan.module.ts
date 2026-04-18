import { Module } from '@nestjs/common';
import { DailyPlanController } from './daily-plan.controller';
import { DailyPlanService } from './daily-plan.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DailyPlanController],
  providers: [DailyPlanService],
})
export class DailyPlanModule {}
