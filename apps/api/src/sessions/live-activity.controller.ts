import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionActionGuard } from './guards/session-action.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AuthedUser = { userId: string; email: string };

/**
 * As três ações que a **Live Activity** dispara sozinha, com o app fechado.
 *
 * ## Por que um controller separado
 *
 * As rotas de `/sessions` exigem o ID token do Firebase, que autoriza a conta
 * inteira. Estas aceitam o token de ação — três verbos, uma sessão, validade
 * de um dia (`session-action-token.ts`).
 *
 * Ensinar o guard do Firebase a aceitar uma segunda credencial teria sido menos
 * arquivo e mais risco: toda rota de sessão passaria a ter dois jeitos de
 * entrar, e um erro futuro num deles afrouxaria todas de uma vez. Aqui a
 * superfície fraca é exatamente três rotas, e está escrita no caminho da URL.
 *
 * ## Por que não reusar o path de `/sessions/:id/pause`
 *
 * Mesmo motivo, do lado de quem lê: `POST /sessions/:id/live/pause` diz, só de
 * ser lido, que veio da Live Activity e que a credencial é a fraca. Um path
 * compartilhado esconderia isso.
 *
 * O serviço por baixo é **o mesmo** que os controles em tela chamam — é o que
 * garante que as duas superfícies nunca discordem sobre o que a sessão está
 * fazendo.
 */
@UseGuards(SessionActionGuard)
@Controller('sessions/:id/live')
export class LiveActivityController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('pause')
  pause(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.pauseSession(user.userId, id);
  }

  @Post('resume')
  resume(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.resumeSession(user.userId, id);
  }

  /**
   * Encerra sem tópicos.
   *
   * A tela pergunta o que foi estudado antes de encerrar; a Live Activity não
   * tem como. Encerrar sem tópicos é exatamente o que acontece quando alguém
   * fecha a sessão pela tela e pula a pergunta — não é um caminho novo, é o
   * mesmo com a resposta vazia.
   */
  @Post('end')
  end(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.endSession(user.userId, id, []);
  }
}
