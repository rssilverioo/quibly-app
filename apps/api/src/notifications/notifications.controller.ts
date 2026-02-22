import { Controller, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto } from './dto/register-token.dto';

@Controller('notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  registerToken(
    @CurrentUser() user: { userId: string },
    @Body() dto: RegisterTokenDto,
  ) {
    return this.notificationsService.registerToken(
      user.userId,
      dto.token,
      dto.platform,
    );
  }

  @Delete('unregister-token')
  unregisterToken(
    @CurrentUser() user: { userId: string },
    @Body('token') token: string,
  ) {
    return this.notificationsService.unregisterToken(user.userId, token);
  }
}
