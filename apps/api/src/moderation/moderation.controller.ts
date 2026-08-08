import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { ModerationService } from './moderation.service';
import { CreateReportDto } from './dto/create-report.dto';

/**
 * As duas portas que o Guideline 1.2 da Apple exige de um app com feed e chat.
 *
 * Ficam fora de `rooms` e de `chat` de propósito: bloquear é uma decisão sobre
 * uma **pessoa**, e vale em toda parte onde as duas se encontram — não numa
 * sala só. Pendurar isto numa rota de sala faria a regra parecer local.
 */
@Controller()
@UseGuards(FirebaseAuthGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('blocks')
  listar(@CurrentUser('uid') userId: string) {
    return this.moderation.listarBloqueados(userId);
  }

  @Post('blocks/:id')
  bloquear(@CurrentUser('uid') userId: string, @Param('id') blockedId: string) {
    return this.moderation.bloquear(userId, blockedId);
  }

  @Delete('blocks/:id')
  desbloquear(@CurrentUser('uid') userId: string, @Param('id') blockedId: string) {
    return this.moderation.desbloquear(userId, blockedId);
  }

  @Post('reports')
  denunciar(@CurrentUser('uid') userId: string, @Body() dto: CreateReportDto) {
    return this.moderation.denunciar(userId, {
      targetType: dto.target_type,
      targetId: dto.target_id,
      reason: dto.reason,
      details: dto.details,
    });
  }
}
