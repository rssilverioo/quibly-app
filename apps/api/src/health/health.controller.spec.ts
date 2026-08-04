import { HealthController } from './health.controller';

function makeController(vars: Record<string, string> = {}) {
  return new HealthController({
    get: (chave: string) => vars[chave],
  } as any);
}

describe('HealthController', () => {
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
