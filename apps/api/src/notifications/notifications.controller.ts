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
      dto.locale,
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
    /**
     * Sem chave configurada, ninguém entra — nem com a chave "padrão".
     *
     * Havia aqui um fallback `'quibly-notify-secret'`. O repositório é
     * público, então esse padrão era uma senha publicada: bastava a env não
     * existir no Railway para qualquer pessoa mandar um push para todos os
     * usuários. Endpoint que dispara efeito em terceiros não tem padrão
     * gentil — ou a chave está no ambiente, ou a rota não existe na prática.
     */
    const expectedKey = this.configService.get<string>('NOTIFICATION_API_KEY', '').trim();
    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
      throw new ForbiddenException('Invalid API key');
    }
    return this.notificationsService.broadcastToSegment(
      body.title,
      body.body,
      body.segment || 'all',
    );
  }
}
