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
  it('não expõe nada além de estado, versão e tempo de vida', () => {
    const r = makeController({ RAILWAY_GIT_COMMIT_SHA: 'abc123' }).health();

    expect(Object.keys(r).sort()).toEqual(
      ['commit', 'startedAt', 'status', 'uptimeSeconds'].sort(),
    );
  });
});
