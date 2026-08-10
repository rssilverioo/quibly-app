import { readFileSync } from 'node:fs';
import { HealthController } from './health.controller';

jest.mock('node:fs', () => ({ readFileSync: jest.fn() }));
const lerArquivo = readFileSync as unknown as jest.Mock;

function makeController(vars: Record<string, string> = {}) {
  return new HealthController({
    get: (chave: string) => vars[chave],
  } as any);
}

describe('HealthController', () => {
  beforeEach(() => {
    // Sem carimbo por padrão — é o estado de quem roda a partir de `src`.
    lerArquivo.mockImplementation(() => {
      throw new Error('sem arquivo');
    });
  });

  it('devolve o SHA que a plataforma injetou', () => {
    const r = makeController({ RAILWAY_GIT_COMMIT_SHA: 'abc123' }).health();

    expect(r.status).toBe('ok');
    expect(r.commit).toBe('abc123');
  });

  it('cai em GIT_COMMIT_SHA fora do Railway', () => {
    expect(makeController({ GIT_COMMIT_SHA: 'def456' }).health().commit).toBe('def456');
  });

  it('diz "desconhecido" em vez de undefined quando não há SHA', () => {
    // Numa resposta que alguém lê durante um incidente, `undefined` é um
    // susto; "desconhecido" é uma informação.
    expect(makeController().health().commit).toBe('desconhecido');
  });

  /**
   * O carimbo do build é o que faz isto funcionar fora do Railway sem depender
   * de alguém lembrar de atualizar uma variável.
   *
   * Uma variável fixa continuaria respondendo o mesmo SHA depois do próximo
   * deploy — mentindo com confiança, o que é pior que "desconhecido" numa rota
   * que existe para ser lida durante um incidente.
   */
  it('usa o SHA carimbado no build quando não há variável', () => {
    lerArquivo.mockReturnValue('86068d6\n');

    expect(makeController().health().commit).toBe('86068d6');
  });

  it('a variável da plataforma ganha do carimbo', () => {
    // Se as duas existem, quem injetou é a plataforma, e ela sabe mais.
    lerArquivo.mockReturnValue('carimbo');

    expect(makeController({ RAILWAY_GIT_COMMIT_SHA: 'abc123' }).health().commit).toBe('abc123');
  });

  it('carimbo vazio não vira string vazia na resposta', () => {
    // Build sem git escreve arquivo vazio; a resposta tem que continuar legível.
    lerArquivo.mockReturnValue('   ');

    expect(makeController().health().commit).toBe('desconhecido');
  });

  /**
   * A rota é pública. Se um dia alguém acrescentar nome de bucket, host de
   * banco ou lista de variáveis aqui, isto quebra — que é o objetivo.
   */
  it('não expõe nada além de estado, versão, tempo de vida e prontidão', () => {
    const r = makeController({ RAILWAY_GIT_COMMIT_SHA: 'abc123' }).health();

    // A lista é fechada de propósito: esta rota é pública, e a única forma de
    // ela continuar servindo durante um incidente é ninguém poder acrescentar
    // nome de bucket, host de banco ou lista de variáveis sem passar por aqui.
    //
    // `corsOrigins` entrou em 10/08 e passou por este teste conscientemente:
    // domínio permitido não é segredo — é o contrário, é o que a API já anuncia
    // no cabeçalho a qualquer navegador que pergunte. E foi acrescentado porque
    // de fora não havia como distinguir "CORS_ORIGINS não configurada" de
    // "configurada com um valor que não casa": as duas recusam tudo, caladas.
    expect(Object.keys(r).sort()).toEqual(
      ['commit', 'corsOrigins', 'sessionActionsConfigured', 'startedAt', 'status', 'uptimeSeconds'].sort(),
    );
  });

  /**
   * O campo diz **se** o segredo existe, nunca o que ele é.
   *
   * Sem `SESSION_ACTION_SECRET` a API não cunha `live_action_token`, o app não
   * tem o que gravar, e os botões da Live Activity morrem — com o mesmo
   * sintoma de outras quatro causas. Foi o que fez aquela depuração custar
   * quatro rodadas, e é o que este booleano separa num `curl`.
   */
  describe('sessionActionsConfigured', () => {
    it('é booleano, e nunca o valor do segredo', () => {
      const r = makeController({ SESSION_ACTION_SECRET: 'segredo-de-verdade' }).health();

      expect(r.sessionActionsConfigured).toBe(true);
      expect(JSON.stringify(r)).not.toContain('segredo-de-verdade');
    });

    it('é falso quando a variável falta', () => {
      expect(makeController({}).health().sessionActionsConfigured).toBe(false);
    });

    it('é falso quando a variável existe vazia — que é o caso que engana', () => {
      // Uma variável setada como string vazia no painel parece configurada na
      // lista e não serve para assinar nada.
      expect(makeController({ SESSION_ACTION_SECRET: '   ' }).health().sessionActionsConfigured)
        .toBe(false);
    });
  });
});
