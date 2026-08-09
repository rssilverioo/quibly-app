import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) =>
  readFileSync(new URL(caminho, import.meta.url).pathname, 'utf8');

const iap = ler('../services/iap.ts');
const ajustes = ler('../app/settings/index.tsx');
const precos = ler('../app/pricing/index.tsx');
const easJson = ler('../eas.json');

/**
 * A compra dentro do app foi religada em 09/08/2026.
 *
 * ~~"Desligada em 06/08: o paywall prometia uma compra que no Android nem podia
 * acontecer, e uma tela de assinatura vazia é candidata a Guideline 2.1."~~
 *
 * As duas razões caíram. O paywall passou a guardar uma porta de verdade — o
 * plano grátis vale três salas próprias — e o catálogo existe do outro lado:
 * entitlement `pro`, produtos aprovados na App Store, offering com
 * `$rc_monthly` e `$rc_annual`.
 *
 * O que estes testes protegem agora é o que **não** mudou junto: o Android
 * continua sem chave, e a tela precisa dizer isso em vez de mostrar vazio.
 */
describe('compra no app', () => {
  it('está ligada', () => {
    expect(iap).toContain('export const COMPRAS_NO_APP_ATIVAS = true;');
  });

  /**
   * O modo de falha que motivou tudo isto continua existindo: o RevenueCat
   * **aceita** uma chave inválida e só falha depois, no `getOfferings` — que
   * tem `catch` e devolve `null`. A tela então mostra o estado vazio, que é
   * indistinguível de "ainda carregando" e de "sem produtos nesta região".
   *
   * É o mesmo modo de falha que escondeu o feed vazio por semanas e a Live
   * Activity por meses. Aqui ele custa dinheiro diretamente.
   */
  it('detecta a chave de mentira antes de configurar', () => {
    expect(iap).toContain('const erro = revenueCatConfigError();');
    expect(iap).toMatch(/YOUR_REVENUECAT/);
  });

  it('a tela de preços mostra o erro de configuração, e não o vazio', () => {
    // Vazio mente: parece carregando. O erro diz o que houve.
    expect(precos).toContain('revenueCatConfigError');
  });

  /**
   * Enquanto esta linha for verdade, ligar a compra não liga o Android — só
   * para de escondê-la no iOS, onde ela funciona. O teste existe para que a
   * troca da chave seja uma decisão, e não uma descoberta no dia do
   * lançamento.
   */
  it('o Android ainda está com placeholder, e isso está registrado', () => {
    expect(easJson).toContain('goog_YOUR_REVENUECAT_ANDROID_KEY');
    expect(iap).toContain('O Android continua sem chave');
  });

  it('a porta do plano existe nos ajustes', () => {
    expect(ajustes).toContain('COMPRAS_NO_APP_ATIVAS ? (');
    expect(ajustes).toContain("router.push('/pricing')");
  });

  /**
   * O entitlement se chama `pro` no RevenueCat. Se os dois divergirem, a compra
   * completa e o app continua achando que a pessoa é do plano grátis — a falha
   * mais cara possível, porque o dinheiro sai e nada acontece.
   */
  it('o entitlement casa com o do RevenueCat', () => {
    expect(iap).toContain("const ENTITLEMENT_ID = 'pro';");
  });
});
