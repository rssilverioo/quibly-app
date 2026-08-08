import { idiomaDe, textosPara } from './notification-texts';

/**
 * A notificação chega na tela de bloqueio, entre as de todos os outros apps.
 * Ali quem manda é o idioma do celular — e o servidor mandava tudo em inglês
 * fixo, porque não havia idioma guardado em lugar nenhum.
 */
describe('o idioma da notificação', () => {
  it('segue o aparelho: pt-BR recebe português', () => {
    expect(textosPara('pt-BR').reacaoTitulo).toBe('Reagiram ao seu post');
  });

  /**
   * Compara só a primeira parte da etiqueta. Exigir `pt-BR` exato faria um
   * iPhone português de Portugal cair em inglês por causa do sufixo.
   */
  it('pt-PT e pt são o mesmo português', () => {
    expect(idiomaDe('pt-PT')).toBe('pt');
    expect(idiomaDe('pt')).toBe('pt');
    expect(idiomaDe('PT-br')).toBe('pt');
  });

  /**
   * Inglês, e não português: o app é distribuído mundialmente e a maioria dos
   * idiomas do mundo cai aqui. Quem fala português recebe português porque o
   * aparelho diz `pt`, não porque a empresa é brasileira.
   */
  it('cai em inglês para qualquer idioma que não temos', () => {
    expect(idiomaDe('ja-JP')).toBe('en');
    expect(idiomaDe('es-AR')).toBe('en');
    expect(textosPara('fr-FR').reacaoTitulo).toBe('New reaction');
  });

  /** Tokens registrados antes da coluna existir têm `locale` nulo. */
  it('token antigo, sem idioma, não quebra', () => {
    expect(idiomaDe(null)).toBe('en');
    expect(idiomaDe(undefined)).toBe('en');
    expect(textosPara(null).reacaoTitulo).toBe('New reaction');
  });

  it('os dois idiomas cobrem as mesmas chaves', () => {
    // Uma chave a mais num idioma vira `undefined` na notificação do outro —
    // e um título vazio na tela de bloqueio.
    expect(Object.keys(textosPara('pt')).sort()).toEqual(
      Object.keys(textosPara('en')).sort(),
    );
  });
});
