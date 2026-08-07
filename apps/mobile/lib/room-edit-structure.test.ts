import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (p: string) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8');
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const tela = semComentarios(ler('../app/league/room/edit/[id].tsx'));
const sala = semComentarios(ler('../app/league/room/[id].tsx'));

/**
 * Editar sala é a única superfície onde um membro poderia estragar o que é de
 * outro. A tela é conveniência; quem protege é a API — mas mostrar uma ação que
 * será recusada é pior que escondê-la, porque promete o que não existe.
 */
describe('edição de sala', () => {
  it('a porta de entrada aparece só para o dono', () => {
    expect(sala).toContain("role === 'owner'");
  });

  /**
   * A data define a janela do desafio. Editá-la com gente estudando mudaria o
   * resultado de uma disputa em andamento.
   */
  it('não oferece campo de data', () => {
    expect(tela).not.toMatch(/startDate|endDate|DatePicker|start_date/);
    expect(ler('../app/league/room/edit/[id].tsx')).toContain('dateLocked');
  });

  it('apagar pede confirmação e nomeia a consequência', () => {
    // "Tem certeza?" não informa nada. O que decide é saber que o histórico de
    // todo mundo vai junto.
    expect(tela).toContain('Alert.alert');
    expect(tela).toContain("t('rooms.deleteBody')");
    expect(tela).toContain("style: 'destructive'");
  });

  it('depois de apagar, não volta para a sala que deixou de existir', () => {
    expect(tela).toContain("router.replace('/(tabs)')");
  });

  it('a capa aparece na hora e volta atrás se o upload falhar', () => {
    // Esperar a rede para trocar a imagem faria o toque parecer ignorado; não
    // reverter faria a tela mentir sobre o que foi salvo.
    const trocar = tela.slice(tela.indexOf('const trocarCapa'));
    expect(trocar).toMatch(/setCapa\(asset\.uri\)[\s\S]*updateRoomCover/);
    expect(trocar).toMatch(/catch[\s\S]*setCapa\(cover/);
  });

  it('recusa nome curto antes de ir à rede', () => {
    expect(tela).toContain('nameTooShort');
  });
});

describe('as chaves de tradução existem nas duas línguas', () => {
  const pt = JSON.parse(ler('../locales/pt-BR/common.json')).rooms;
  const en = JSON.parse(ler('../locales/en/common.json')).rooms;

  it.each([
    'editRoom', 'save', 'changeCover', 'roomName', 'roomDescription',
    'dateLocked', 'deleteRoom', 'deleteTitle', 'deleteBody', 'deleteConfirm',
    'nameTooShort', 'editError',
  ])('%s', (chave) => {
    // Sem a chave, o i18next imprime o nome dela na tela do usuário.
    expect(typeof pt[chave]).toBe('string');
    expect(typeof en[chave]).toBe('string');
  });
});
