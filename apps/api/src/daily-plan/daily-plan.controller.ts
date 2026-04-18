import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DailyPlanService } from './daily-plan.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(FirebaseAuthGuard)
@Controller('daily-plan')
export class DailyPlanController {
  constructor(private readonly service: DailyPlanService) {}

  @Get()
  getPlan(@CurrentUser() user: { userId: string }) {
    return this.service.getPlan(user.userId);
  }

  @Post(':taskId/complete')
  completeTask(
    @CurrentUser() user: { userId: string },
    @Param('taskId') taskId: string,
  ) {
    return this.service.completeTask(user.userId, taskId);
  }
}
