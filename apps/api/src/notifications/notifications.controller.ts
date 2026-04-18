import { Controller, Post, Delete, Body, UseGuards, Headers, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto } from './dto/register-token.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register-token')
  @UseGuards(FirebaseAuthGuard)
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
  @UseGuards(FirebaseAuthGuard)
  unregisterToken(
    @CurrentUser() user: { userId: string },
    @Body('token') token: string,
  ) {
    return this.notificationsService.unregisterToken(user.userId, token);
  }

  @Post('broadcast')
  broadcast(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { title: string; body: string; segment?: 'all' | 'pro' | 'free' },
  ) {
    const expectedKey = this.configService.get<string>('NOTIFICATION_API_KEY', 'quibly-notify-secret');
    if (!apiKey || apiKey !== expectedKey) {
      throw new ForbiddenException('Invalid API key');
    }
    return this.notificationsService.broadcastToSegment(
      body.title,
      body.body,
      body.segment || 'all',
    );
  }
}
