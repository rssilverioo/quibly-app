import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);
  private knownProfiles = new Set<string>();

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      const decodedToken = await this.firebaseService
        .getAuth()
        .verifyIdToken(token);

      const userId = decodedToken.uid;
      const email = decodedToken.email || '';

      /**
       * Conta suspensa não passa daqui.
       *
       * ## Por que no guard, e não em cada rota
       *
       * Suspensão que só cobre algumas rotas não é suspensão: quem quisesse
       * continuar postando acharia o caminho que ninguém protegeu. Aqui vale
       * para tudo que exige login, de uma vez.
       *
       * ## Por que não usa o cache de perfis conhecidos
       *
       * `knownProfiles` existe para evitar o `upsert` a cada requisição, e é
       * povoado uma vez por processo. Se a suspensão dependesse dele, banir
       * alguém que já usou o app naquele processo não teria efeito **até o
       * próximo deploy** — a pior forma de uma punição falhar, porque parece
       * aplicada.
       *
       * Custa uma consulta por requisição. É o preço de a decisão valer no
       * instante em que é tomada.
       */
      const suspensao = await this.prisma.profile.findUnique({
        where: { id: userId },
        select: { bannedAt: true },
      });
      if (suspensao?.bannedAt) {
        // 403 e não 401: 401 faria o app tentar renovar o token e entrar num
        // laço de login que nunca conclui, sem nunca dizer o que houve.
        throw new ForbiddenException('Account suspended');
      }

      // Auto-create profile if it doesn't exist yet (cached to avoid DB hit on every request)
      if (!this.knownProfiles.has(userId)) {
        await this.prisma.profile.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            email,
            username: decodedToken.name || email.split('@')[0] || 'user',
            handle: (decodedToken.name || email.split('@')[0] || 'user')
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_')
              .slice(0, 30),
          },
        });
        this.knownProfiles.add(userId);
      }

      request.user = { userId, email };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      // A suspensão não é falha de token — deixar cair no `catch` a
      // transformaria em "token inválido", e o app pediria login de novo.
      if (error instanceof ForbiddenException) throw error;

      /*
       Só o que veio do Firebase vira "token inválido".

       Este `catch` cobre três coisas muito diferentes: o token de fato
       inválido, o banco fora do ar, e a credencial do Firebase ausente no
       ambiente. Tratar as três como "Invalid or expired Firebase token" faz o
       app pedir login de novo — e o login **funciona**, porque o problema nunca
       esteve no token. A pessoa entra, tenta de novo, toma 401 outra vez.

       Custou uma rodada em 10/08, num serviço recém-criado: o painel dizia
       "token inválido" com um token perfeitamente válido, e a mensagem apontava
       para o único lugar onde o defeito não estava.

       O código do `firebase-admin` sempre começa com `auth/`. O resto é nosso
       problema, e merece 500 — que é o que faz o log registrar em vez de o
       cliente sair procurando a própria conta.
      */
      const codigo = (error as { code?: string })?.code ?? '';
      if (typeof codigo === 'string' && codigo.startsWith('auth/')) {
        throw new UnauthorizedException('Invalid or expired Firebase token');
      }

      this.logger.error(
        `Falha ao autenticar que não é do token: ${(error as Error)?.message ?? error}`,
      );
      throw new ServiceUnavailableException(
        'Authentication is temporarily unavailable',
      );
    }
  }
}
