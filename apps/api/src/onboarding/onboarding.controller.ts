import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto } from './onboarding.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(FirebaseAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Post()
  complete(
    @CurrentUser() user: { userId: string },
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.service.complete(user.userId, dto);
  }
}
