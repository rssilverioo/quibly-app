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
   * Em 21/09/2026 o Android ganhou chave de verdade: app Google Play criado no
   * RevenueCat, produtos `com.quibly.app.pro.monthly|yearly` no Play Console.
   * O teste garante que o placeholder não volte por um merge distraído — e que
   * a detecção de placeholder continue existindo, porque um build sem chave
   * ainda é possível em perfil novo.
   */
  it('o Android tem chave de verdade em todos os perfis', () => {
    expect(easJson).not.toContain('YOUR_REVENUECAT');
    expect(easJson.match(/"EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID": "goog_[A-Za-z]{20,}"/g)).toHaveLength(3);
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

  /**
   * O paywall é o do RevenueCat (21/09/2026): layout e preços vêm do painel,
   * anexados à offering atual. A tela própria fica só para quem já é Pro.
   * Se alguém remover o componente, a rota volta a mostrar a tela antiga em
   * silêncio — e o paywall desenhado no painel deixa de valer sem aviso.
   */
  it('mostra o paywall do RevenueCat para quem não é Pro', () => {
    expect(precos).toContain("from 'react-native-purchases-ui'");
    expect(precos).toContain('<RevenueCatUI.Paywall');
    expect(precos).toContain('if (!isPro && COMPRAS_NO_APP_ATIVAS && !erroDeConfig)');
  });
});
