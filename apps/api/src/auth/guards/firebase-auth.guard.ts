import {
  CanActivate,
  ExecutionContext,
  ConflictException,
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

  /**
   * Cria o perfil na primeira requisição — sem deixar um nome repetido trancar
   * a conta para sempre.
   *
   * ## O defeito
   *
   * `handle` e `email` são `@unique`, e o `handle` nascia do e-mail:
   * `rodrigo.silverio@…` virava `rodrigo_silverio`. Quando esse nome já existia,
   * o insert batia na restrição e **toda** requisição daquela conta falhava —
   * não só o cadastro. A pessoa entrava normalmente no Firebase e o app
   * respondia erro para sempre, sem nada dizendo por quê.
   *
   * Aconteceu em 10/08 e apareceu como "Authentication is temporarily
   * unavailable": um `P2002` disfarçado de indisponibilidade.
   *
   * ## Como o nome é escolhido agora
   *
   * O primeiro candidato é o mesmo de antes, para quem chega primeiro continuar
   * com o nome bonito. Se ele estiver ocupado, entra um sufixo tirado do
   * próprio id — determinístico, então a mesma conta gera sempre o mesmo nome,
   * e duas contas diferentes nunca convergem.
   *
   * ## E-mail repetido é outra história
   *
   * Não dá para contornar: dois usuários do Firebase apontando para o mesmo
   * e-mail no nosso banco significa que uma conta foi recriada, e os dados
   * antigos pertencem à antiga. Inventar um sufixo no e-mail corromperia o
   * dado. Isso vira 409 com mensagem própria — um problema que precisa de
   * decisão humana, não de contorno automático.
   */
  private async garantirPerfil(
    userId: string,
    email: string,
    nome?: string,
  ): Promise<void> {
    const base = (nome || email.split('@')[0] || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 30);

    // O id é opaco e longo; os últimos caracteres bastam para separar duas
    // pessoas com o mesmo nome, e mantêm o handle legível.
    const sufixo = userId.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, '');
    const candidatos = [base, `${base.slice(0, 23)}_${sufixo}`];

    for (const handle of candidatos) {
      try {
        await this.prisma.profile.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            email,
            username: nome || email.split('@')[0] || 'user',
            handle,
          },
        });
        return;
      } catch (erro) {
        const codigo = (erro as { code?: string })?.code;
        const campos = ((erro as { meta?: { target?: string[] } })?.meta?.target ?? []) as string[];
        if (codigo !== 'P2002') throw erro;

        if (campos.includes('email')) {
          this.logger.error(
            `E-mail já usado por outro perfil ao criar ${userId}: ${email}`,
          );
          throw new ConflictException(
            'This email already belongs to another account',
          );
        }
        // Handle ocupado: segue para o próximo candidato.
      }
    }

    // Os dois candidatos ocupados. Improvável — exigiria colisão do sufixo do
    // id —, e mesmo assim é melhor gritar do que criar um nome aleatório que
    // ninguém reconhece depois.
    this.logger.error(`Não achei handle livre para ${userId}`);
    throw new ConflictException('Could not pick a unique handle');
  }

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
        await this.garantirPerfil(userId, email, decodedToken.name);
        this.knownProfiles.add(userId);
      }

      request.user = { userId, email };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      // A suspensão não é falha de token — deixar cair no `catch` a
      // transformaria em "token inválido", e o app pediria login de novo.
      if (error instanceof ForbiddenException) throw error;
      // Conflito de cadastro é decisão humana, não indisponibilidade.
      if (error instanceof ConflictException) throw error;

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
      /*
       O código vai na resposta, a mensagem não.

       Código de erro do Prisma (`P2022` = coluna ausente, `P1001` = banco
       inalcançável) é vocabulário fechado e público, e é exatamente o que
       distingue "falta migração" de "banco fora do ar" sem precisar de acesso
       ao log da plataforma. A **mensagem** fica de fora: ela costuma trazer
       nome de tabela, de coluna e às vezes host.
      */
      throw new ServiceUnavailableException({
        message: 'Authentication is temporarily unavailable',
        code: (error as { code?: string })?.code ?? 'desconhecido',
      });
    }
  }
}
