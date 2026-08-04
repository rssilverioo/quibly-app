import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(private readonly configService: ConfigService) {}

  @Get()
  health() {
    return {
      status: 'ok',
      // `RAILWAY_GIT_COMMIT_SHA` é injetada pela plataforma. O fallback existe
      // para rodar fora do Railway sem virar `undefined` numa resposta que
      // alguém vai ler durante um incidente — "desconhecido" é uma informação,
      // `undefined` é um susto.
      commit:
        this.configService.get<string>('RAILWAY_GIT_COMMIT_SHA') ??
        this.configService.get<string>('GIT_COMMIT_SHA') ??
        'desconhecido',
      startedAt: this.subiuEm.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.subiuEm.getTime()) / 1000),
    };
  }
}
