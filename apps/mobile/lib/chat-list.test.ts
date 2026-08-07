import { describe, expect, it } from 'vitest';
import {
  bolhaOtimista,
  confirmar,
  ehLocal,
  inserir,
  marcarApagada,
  marcarFalha,
  reconciliar,
  type MensagemNaTela,
} from './chat-list';

const EU = 'u-eu';

const msg = (id: string, extra: Partial<MensagemNaTela> = {}): MensagemNaTela => ({
  id,
  league_id: 'sala',
  user_id: 'u-outro',
  content: 'oi',
  message_type: 'text',
  created_at: '2026-08-07T10:00:00.000Z',
  ...extra,
});

describe('bolhaOtimista', () => {
  it('nasce pendente, minha, e com id local reconhecível', () => {
    const b = bolhaOtimista('teste', EU, 'sala', new Date('2026-08-07T10:00:00Z'));

    expect(b.pendente).toBe(true);
    expect(b.user_id).toBe(EU);
    expect(ehLocal(b.id)).toBe(true);
  });
});

/**
 * O autor recebe a mesma mensagem duas vezes — pela resposta do POST e pelo eco
 * do socket — e não há ordem garantida entre as duas.
 */
describe('inserir', () => {
  it('não duplica quando a mesma mensagem chega duas vezes', () => {
    const lista = inserir([], msg('m1'), EU);

    expect(inserir(lista, msg('m1'), EU)).toHaveLength(1);
  });

  it('atualiza no lugar, para o eco completar o que o POST não trouxe', () => {
    const lista = inserir([], msg('m1', { user: undefined }), EU);

    const depois = inserir(lista, msg('m1', { user: { username: 'ana' } }), EU);

    expect(depois).toHaveLength(1);
    expect(depois[0].user?.username).toBe('ana');
  });

  it('mantém a mais nova primeiro, que é a ordem da lista invertida', () => {
    let lista: MensagemNaTela[] = [];
    lista = inserir(lista, msg('velha', { created_at: '2026-08-07T09:00:00.000Z' }), EU);
    lista = inserir(lista, msg('nova', { created_at: '2026-08-07T11:00:00.000Z' }), EU);

    expect(lista.map((m) => m.id)).toEqual(['nova', 'velha']);
  });

  /**
   * O caso que duplicaria texto na tela: o eco do socket chega antes da resposta
   * do POST, então a bolha local ainda está lá.
   */
  it('remove a bolha otimista quando a real chega antes do POST responder', () => {
    const bolha = bolhaOtimista('bom dia', EU, 'sala');
    const real = msg('m-real', { user_id: EU, content: 'bom dia' });

    const depois = inserir([bolha], real, EU);

    expect(depois).toHaveLength(1);
    expect(depois[0].id).toBe('m-real');
  });

  it('não confunde a bolha de outra pessoa com a minha', () => {
    const minha = bolhaOtimista('igual', EU, 'sala');
    const deOutro = msg('m-outro', { user_id: 'u-outro', content: 'igual' });

    // Mesmo texto, autor diferente: a minha bolha continua pendente.
    const depois = inserir([minha], deOutro, EU);

    expect(depois).toHaveLength(2);
  });

  it('remove uma bolha por mensagem, e a mais velha primeiro', () => {
    const a = { ...bolhaOtimista('oi', EU, 'sala'), id: 'local:1', created_at: '2026-08-07T10:00:00.000Z' };
    const b = { ...bolhaOtimista('oi', EU, 'sala'), id: 'local:2', created_at: '2026-08-07T10:00:01.000Z' };

    const depois = inserir([b, a], msg('m-real', { user_id: EU, content: 'oi' }), EU);

    // Duas iguais enviadas em sequência: só uma sai.
    expect(depois.filter((m) => m.pendente)).toHaveLength(1);
    expect(depois.some((m) => m.id === 'local:2')).toBe(true);
  });

  it('não remove bolha que já falhou — ela espera o dedo do usuário', () => {
    const falha = { ...bolhaOtimista('oi', EU, 'sala'), pendente: false, falhou: true };

    const depois = inserir([falha], msg('m-real', { user_id: EU, content: 'oi' }), EU);

    expect(depois).toHaveLength(2);
  });
});

describe('confirmar', () => {
  it('troca a bolha local pela mensagem do servidor', () => {
    const bolha = bolhaOtimista('oi', EU, 'sala');
    const depois = confirmar([bolha], bolha.id, msg('m-real', { user_id: EU }));

    expect(depois).toHaveLength(1);
    expect(depois[0].id).toBe('m-real');
    expect(depois[0].pendente).toBe(false);
  });

  it('se o eco já inseriu a real, a local só sai — não duplica', () => {
    const bolha = bolhaOtimista('oi', EU, 'sala');
    const real = msg('m-real', { user_id: EU });

    const depois = confirmar([real, bolha], bolha.id, real);

    expect(depois).toHaveLength(1);
    expect(depois[0].id).toBe('m-real');
  });
});

describe('marcarFalha', () => {
  it('deixa a bolha na tela para não perder o texto', () => {
    const bolha = bolhaOtimista('texto longo', EU, 'sala');

    const [depois] = marcarFalha([bolha], bolha.id);

    expect(depois.falhou).toBe(true);
    expect(depois.pendente).toBe(false);
    expect(depois.content).toBe('texto longo');
  });
});

describe('marcarApagada', () => {
  it('zera o conteúdo também na tela de quem já estava com a sala aberta', () => {
    const lista = [msg('m1', { content: 'ofensa' })];

    const [depois] = marcarApagada(lista, 'm1');

    // Sem isto o texto ficaria na memória do aparelho até reabrir a conversa —
    // que é justamente quando apagar importa.
    expect(depois.content).toBe('');
    expect(depois.deleted_at).toBeTruthy();
  });
});

/**
 * A busca é a verdade sobre o que foi gravado, mas não conhece o que ainda não
 * foi: sobrescrever com o resultado cru faria a mensagem recém-escrita sumir e
 * voltar um segundo depois.
 */
describe('reconciliar', () => {
  it('preserva a bolha pendente que o servidor ainda não conhece', () => {
    const bolha = bolhaOtimista('enviando', EU, 'sala');

    const depois = reconciliar([msg('m1')], [bolha, msg('m1')]);

    expect(depois.some((m) => m.id === bolha.id)).toBe(true);
    expect(depois).toHaveLength(2);
  });

  it('descarta a local quando o servidor já a devolve com id de verdade', () => {
    const real = msg('m1', { user_id: EU });

    const depois = reconciliar([real], [real]);

    expect(depois).toHaveLength(1);
  });

  it('devolve tudo da mais nova para a mais velha', () => {
    const velha = msg('velha', { created_at: '2026-08-07T08:00:00.000Z' });
    const nova = msg('nova', { created_at: '2026-08-07T12:00:00.000Z' });

    expect(reconciliar([velha, nova], []).map((m) => m.id)).toEqual(['nova', 'velha']);
  });
});
