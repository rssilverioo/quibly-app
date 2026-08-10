import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Diz **qual código está no ar**, sem autenticação e sem segredo.
 *
 * Existe porque em 03/08 passei meia hora tentando responder "meu conserto foi
 * deployado?" e não consegui. As rotas provam o que a API *tem*, não a versão:
 * um conserto de comportamento — a contagem de check-ins, por exemplo — não
 * cria rota nova e fica invisível de fora. O painel do Railway também não
 * serviu: o `createdAt` do deploy ativo apontava 28/07 enquanto rotas de 31/07
 * respondiam, ou seja, o campo não é a data que parece ser.
 *
 * Com isto, a pergunta vira um `curl` e a resposta é o SHA. É o mesmo princípio
 * do teste calibrado que a gente usa aqui o tempo todo: em vez de inferir do
 * git local, perguntar a quem sabe.
 *
 * **Nada aqui pode ser secreto.** A rota é pública de propósito — é o único
 * jeito de ela servir durante um incidente, quando ninguém quer descobrir
 * credencial para saber se o deploy subiu. Por isso devolve só o SHA do commit
 * (que é público no GitHub) e há quanto tempo o processo está de pé. Nunca
 * acrescente aqui nome de bucket, host de banco, chave, nem lista de variáveis.
 */
@Controller('health')
export class HealthController {
  private readonly subiuEm = new Date();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Qual commit está rodando, na ordem em que as fontes merecem confiança.
   *
   * `RAILWAY_GIT_COMMIT_SHA` é injetada pela plataforma — quando existe, é a
   * verdade. `GIT_COMMIT_SHA` é o override manual, para quem tem outra forma de
   * injetar. E o `dist/COMMIT` é carimbado **no build** (ver `nixpacks.toml`),
   * que é o que faz isto funcionar fora do Railway sem depender de ninguém
   * lembrar de atualizar.
   *
   * A ordem importa: o arquivo vem por último porque só um humano distraído
   * setaria uma variável errada, enquanto o arquivo é gerado pela mesma
   * construção que produziu o binário — ele não tem como discordar de si mesmo.
   *
   * Lido uma vez, na construção do controller. O valor não muda enquanto o
   * processo vive, e ler arquivo a cada `/health` seria I/O para responder
   * sempre a mesma coisa.
   */
  private readonly commit: string =
    this.configService.get<string>('RAILWAY_GIT_COMMIT_SHA') ??
    this.configService.get<string>('GIT_COMMIT_SHA') ??
    this.commitDoBuild() ??
    'desconhecido';

  /** O SHA carimbado no `dist/` durante o build, ou `null`. */
  private commitDoBuild(): string | null {
    try {
      // `__dirname` é `dist/health` em produção; o carimbo fica na raiz do
      // `dist`. Caminho relativo ao arquivo, e não ao cwd, porque o processo
      // pode ser iniciado de qualquer lugar.
      const carimbo = readFileSync(join(__dirname, '..', 'COMMIT'), 'utf8').trim();
      return carimbo || null;
    } catch {
      // Rodando de `src` em desenvolvimento, ou build sem git. Não é erro.
      return null;
    }
  }

  /**
   * `ok` | `esquema-atrasado` | `inalcancavel`.
   *
   * Três respostas porque são três consertos diferentes: nada, rodar a
   * migração, e olhar a `DATABASE_URL`. Um booleano juntaria os dois últimos.
   */
  private async sondarBanco(): Promise<string> {
    try {
      await this.prisma.profile.findFirst({ select: { bannedAt: true } });
      return 'ok';
    } catch (erro) {
      const codigo = (erro as { code?: string })?.code;
      // `P2022` é "a coluna não existe" — banco de pé, esquema atrasado.
      return codigo === 'P2022' ? 'esquema-atrasado' : 'inalcancavel';
    }
  }

  @Get()
  async health() {
    return {
      status: 'ok',
      // `RAILWAY_GIT_COMMIT_SHA` é injetada pela plataforma. O fallback existe
      // para rodar fora do Railway sem virar `undefined` numa resposta que
      // alguém vai ler durante um incidente — "desconhecido" é uma informação,
      // `undefined` é um susto.
      commit: this.commit,
      startedAt: this.subiuEm.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.subiuEm.getTime()) / 1000),
      /**
       * As origens de navegador que a API aceita.
       *
       * Mesma razão do booleano abaixo: de fora não havia como distinguir
       * "`CORS_ORIGINS` não foi configurada" de "foi configurada com um valor
       * que não casa" — os dois recusam toda origem, calados. Em 10/08 isso
       * custou uma rodada: a variável estava lá, o serviço tinha reiniciado, e
       * o painel continuava sem conseguir falar com a API.
       *
       * Domínio permitido não é segredo. É o oposto: é o que a API anuncia a
       * qualquer navegador que pergunte, no cabeçalho da resposta.
       */
      /**
       * Se a API tem credencial para verificar token do Firebase.
       *
       * Sem ela, `verifyIdToken` falha em **toda** requisição e o cliente
       * recebe "token inválido" — apontando para o único lugar onde o defeito
       * não está. Quem recebe isso vai conferir o login, refazer o login, e
       * tomar 401 de novo.
       *
       * Diz **se** existe, nunca o que é — mesma regra do
       * `session_actions_configured`. Num serviço recém-criado, é a primeira
       * coisa que falta e a última em que se pensa.
       */
      /**
       * Se o banco responde **e** tem o esquema que este código espera.
       *
       * `SELECT 1` prova só que há conexão. O que derruba um serviço recém-criado
       * é outra coisa: o banco de pé com o esquema atrasado, e aí toda rota
       * autenticada falha porque o guard lê uma coluna que não existe.
       *
       * Por isso a sonda lê `banned_at` — a coluna mais nova, criada em 10/08.
       * Se ela responde, a migração chegou.
       */
      database: await this.sondarBanco(),
      firebaseConfigured: Boolean(
        this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON') ||
          (this.configService.get<string>('FIREBASE_PROJECT_ID') &&
            this.configService.get<string>('FIREBASE_CLIENT_EMAIL') &&
            this.configService.get<string>('FIREBASE_PRIVATE_KEY')) ||
          this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS'),
      ),
      corsOrigins: (this.configService.get<string>('CORS_ORIGINS') ?? '')
        .split(',')
        .map((o) => o.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, ''))
        .filter(Boolean),
      /**
       * Se os botões da Live Activity têm como funcionar.
       *
       * Sem `SESSION_ACTION_SECRET`, `cunharTokenDeAcao` devolve `null` de
       * propósito, a sessão sobe sem `live_action_token`, o app não tem o que
       * gravar e o intent do widget morre na terceira guarda. O sintoma é o
       * botão não fazer nada — o mesmo sintoma de mais quatro causas
       * diferentes, e foi isso que fez a depuração custar quatro rodadas.
       *
       * De fora não havia como distinguir: a rota responde 401 tanto quando o
       * segredo falta quanto quando o token é inválido. Este booleano separa as
       * duas coisas num `curl`.
       *
       * **É um booleano, e nunca o valor.** A nota no topo do arquivo continua
       * valendo: dizer que uma variável *existe* não é dizer o que ela é, e é o
       * único jeito de esta rota servir durante um incidente.
       */
      sessionActionsConfigured: Boolean(
        this.configService.get<string>('SESSION_ACTION_SECRET')?.trim(),
      ),
    };
  }
}
