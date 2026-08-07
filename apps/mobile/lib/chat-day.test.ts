import { describe, expect, it } from 'vitest';
import { abreDia, diaCivil, rotuloDoDia } from './chat-day';

const em = (iso: string) => ({ created_at: iso });

const ROTULOS = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  formatarData: (iso: string) => `data:${iso.slice(0, 10)}`,
};

describe('abreDia', () => {
  it('a primeira mensagem sempre abre um dia', () => {
    expect(abreDia(em('2026-08-07T10:00:00'), undefined)).toBe(true);
  });

  it('duas mensagens do mesmo dia não repetem o separador', () => {
    expect(abreDia(em('2026-08-07T23:00:00'), em('2026-08-07T08:00:00'))).toBe(false);
  });

  /**
   * O erro clássico aqui é comparar por diferença de horas: 23h59 e 00h01 estão
   * a dois minutos, e são dias diferentes. A conversa continuaria parecendo
   * certa com o separador faltando.
   */
  it('dois minutos podem ser dois dias', () => {
    expect(abreDia(em('2026-08-08T00:01:00'), em('2026-08-07T23:59:00'))).toBe(true);
  });

  it('vinte horas podem ser o mesmo dia', () => {
    expect(abreDia(em('2026-08-07T23:00:00'), em('2026-08-07T03:00:00'))).toBe(false);
  });
});

describe('diaCivil', () => {
  it('usa a data local, com mês e dia preenchidos', () => {
    expect(diaCivil('2026-01-05T10:00:00')).toBe('2026-01-05');
  });
});

describe('rotuloDoDia', () => {
  const agora = new Date('2026-08-07T12:00:00');

  it('hoje e ontem vêm do i18n', () => {
    expect(rotuloDoDia('2026-08-07T01:00:00', ROTULOS, agora)).toBe('Hoje');
    expect(rotuloDoDia('2026-08-06T23:00:00', ROTULOS, agora)).toBe('Ontem');
  });

  it('mais velho que ontem vira data formatada', () => {
    expect(rotuloDoDia('2026-08-05T23:00:00', ROTULOS, agora)).toBe('data:2026-08-05');
  });

  /**
   * Uma mensagem com hora à frente do relógio local — relógio do aparelho
   * atrasado, fuso do servidor — não pode virar "amanhã", que não é um rótulo
   * que a conversa tem. Cai em "Hoje".
   */
  it('data no futuro cai em Hoje, e não num rótulo que não existe', () => {
    expect(rotuloDoDia('2026-08-08T03:00:00', ROTULOS, agora)).toBe('Hoje');
  });

  it('a virada da meia-noite muda o rótulo, não a diferença em horas', () => {
    // 23h59 de ontem está a 12h01 de agora, e ainda assim é "Ontem".
    expect(rotuloDoDia('2026-08-06T23:59:00', ROTULOS, agora)).toBe('Ontem');
  });
});
