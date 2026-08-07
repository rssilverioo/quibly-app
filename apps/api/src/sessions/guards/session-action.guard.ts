import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lerTokenDeAcao } from '../session-action-token';

/**
 * Autoriza as rotas que a **Live Activity** chama sozinha, sem o app.
 *
 * ## Por que um guard separado do Firebase
 *
 * As rotas normais de sessão exigem o ID token do Firebase, que autoriza a conta
 * inteira. Estas aqui aceitam só o token de ação — três verbos, uma sessão.
 *
 * Separar em rotas próprias, em vez de ensinar o guard do Firebase a aceitar um
 * segundo tipo de credencial, é a escolha que mantém a superfície honesta: quem
 * lê `POST /sessions/:id/live/pause` sabe que ali entra uma credencial fraca, e
 * nenhuma rota existente ficou mais permissiva do que era.
 *
 * ## A checagem que dá sentido ao token
 *
 * O token **precisa nomear a mesma sessão da URL**. Sem esta comparação, um
 * token legítimo de uma sessão qualquer encerraria a sessão de outra pessoa — o
 * escopo estaria no papel e não no código.
 */
@Injectable()
export class SessionActionGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const header: string | undefined = request.headers['authorization'];
    const token = header?.startsWith('SessionAction ')
      ? header.slice('SessionAction '.length).trim()
      : undefined;

    const acao = lerTokenDeAcao(
      token,
      this.configService.get<string>('SESSION_ACTION_SECRET'),
    );

    // Uma mensagem só para os três motivos possíveis — formato, assinatura,
    // validade. Distinguir daria a quem tenta forjar um oráculo de graça.
    if (!acao) throw new UnauthorizedException('Invalid session action token');

    if (acao.sessionId !== request.params?.id) {
      throw new UnauthorizedException('Token does not authorize this session');
    }

    // O serviço espera o dono da sessão. Vem do token assinado, nunca do que o
    // cliente mandou no corpo ou na URL.
    request.user = { userId: acao.userId, email: '' };
    return true;
  }
}
