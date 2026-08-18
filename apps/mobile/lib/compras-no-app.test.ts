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
   * Este teste era o inverso até 14/08: ele exigia que a chave **fosse** o
   * placeholder, para que a troca fosse uma decisão e não uma descoberta no dia
   * do lançamento. A decisão foi tomada — a chave real entrou —, e agora ele
   * guarda o outro lado.
   *
   * Chave de placeholder num perfil de produção significa tela de planos vazia
   * no Android, que é indistinguível de "carregando" para quem está com o
   * dedo na tela e o cartão na mão.
   */
  it('as duas plataformas têm chave de verdade nos três perfis', () => {
    expect(easJson).not.toContain('YOUR_REVENUECAT');
    for (const [, chave] of easJson.matchAll(
      /"EXPO_PUBLIC_REVENUECAT_API_KEY_(?:IOS|ANDROID)":\s*"([^"]*)"/g,
    )) {
      expect(chave).toMatch(/^(appl|goog)_[A-Za-z0-9]{10,}$/);
    }
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

/**
 * O teste grátis, ligado em 18/08/2026.
 *
 * Quem define a duração é a **loja** — oferta introdutória no App Store Connect,
 * oferta do plano base na Play Console. Estes testes guardam a única coisa que
 * o código não pode fazer sozinho: inventar a promessa.
 *
 * A regra por trás de cada um está em `lib/teste-gratis.ts`, e o comportamento
 * delas está coberto em `lib/teste-gratis.test.ts`. Aqui é o fio: a tela lê o
 * produto, e não uma constante.
 */
describe('teste grátis', () => {
  const useIap = ler('../hooks/useIAP.ts');
  const traducoes = JSON.parse(ler('../locales/pt-BR/pricing.json'));

  it('a duração vem do produto, não do código', () => {
    // Um `7` escrito aqui é a mesma promessa quebrada que o `17%` de desconto
    // fixo era: no dia em que alguém mexer na oferta, a tela mente e nada
    // deixa de compilar.
    expect(precos).toContain('diasDeTeste(billing)');
    expect(useIap).toContain('diasDeTesteGratis(pkg.product)');
    for (const chave of ['trialHeadline', 'startTrial', 'trialDisclosure'] as const) {
      expect(traducoes[chave]).toContain('{{days}}');
      expect(traducoes[chave]).not.toMatch(/\b\d+\s*(dias?|days?)\b/);
    }
  });

  /**
   * O erro que cobra na hora: quem já usou os 7 dias lê "7 dias grátis", toca
   * o botão, e a Apple debita. A tela só promete quando a elegibilidade desta
   * conta confirma.
   */
  it('a promessa passa pela elegibilidade', () => {
    expect(useIap).toContain('podePrometerTeste');
    expect(useIap).toContain('elegibilidadeDeTeste');
  });

  /**
   * A Apple (3.1.2) exige duração, preço depois e renovação automática juntos,
   * onde a compra acontece. O texto sem teste diria que a cobrança é hoje.
   */
  it('a divulgação muda quando há teste', () => {
    expect(precos).toContain("t('trialDisclosure'");
    expect(traducoes.trialDisclosure).toMatch(/renova/i);
    expect(traducoes.trialDisclosure).toContain('{{price}}');
  });
});
