import { describe, expect, it } from 'vitest';

import { idiomaAceito } from './idioma';

describe('idiomaAceito', () => {
  it('lê o que o navegador pede', () => {
    expect(idiomaAceito('pt-BR,pt;q=0.9,en;q=0.8')).toBe('pt');
    expect(idiomaAceito('en-US,en;q=0.9')).toBe('en');
  });

  it('trata `pt-BR` e `pt-PT` como a mesma escolha', () => {
    expect(idiomaAceito('pt-PT')).toBe('pt');
  });

  it('respeita o `q`, e não a ordem em que os itens aparecem', () => {
    // Um cabeçalho assim é raro mas legal: quem escreveu quer inglês.
    expect(idiomaAceito('pt;q=0.2,en;q=0.9')).toBe('en');
  });

  it('desempata pela ordem do cabeçalho quando o `q` é igual', () => {
    expect(idiomaAceito('pt,en')).toBe('pt');
    expect(idiomaAceito('en,pt')).toBe('en');
  });

  it('pula idiomas que não falamos e fica com o melhor que sobrou', () => {
    expect(idiomaAceito('fr-FR,fr;q=0.9,pt;q=0.5')).toBe('pt');
  });

  it('`q=0` é "não me mande isto", e não "tanto faz"', () => {
    expect(idiomaAceito('pt;q=0,en;q=0.1')).toBe('en');
  });

  it('cai em inglês quando não há pedido, ou quando não falamos nada do que pediram', () => {
    // Inglês e não português: o desconhecido é o mundo, não o Brasil.
    expect(idiomaAceito(null)).toBe('en');
    expect(idiomaAceito('')).toBe('en');
    expect(idiomaAceito('ja,ko;q=0.8')).toBe('en');
  });

  it('não deixa um `q` inválido virar preferência máxima', () => {
    // `Number.parseFloat('alto')` é `NaN`; tratado como 1, ele venceria tudo.
    expect(idiomaAceito('pt;q=alto,en;q=0.5')).toBe('en');
  });
});
