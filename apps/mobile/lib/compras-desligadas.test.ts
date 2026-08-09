import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) =>
  readFileSync(new URL(caminho, import.meta.url).pathname, 'utf8');

const iap = ler('../services/iap.ts');
const perfil = ler('../app/(tabs)/profile.tsx');
const ajustes = ler('../app/settings/index.tsx');
const precos = ler('../app/pricing/index.tsx');

/**
 * Compra dentro do app está desligada desde 06/08/2026, por decisão do dono do
 * produto. O que este teste protege não é a decisão — é a **completude** dela.
 *
 * Desligar pela metade é pior que não desligar: uma porta esquecida leva a um
 * paywall que carrega vazio, e vazio é indistinguível de "ainda carregando".
 * São três portas, e todas precisam responder à mesma constante.
 *
 * Para religar: `COMPRAS_NO_APP_ATIVAS = true` em `services/iap.ts`. Este teste
 * continua válido — ele afirma que as três portas *consultam* a constante, não
 * que ela seja falsa.
 */
describe('compra no app está desligada em todas as portas', () => {
  it('has a single switch, and it is off', () => {
    expect(iap).toContain('export const COMPRAS_NO_APP_ATIVAS = false;');
  });

  it('does not configure RevenueCat while purchases are off', () => {
    // Configurar com chave de mentira deixa o SDK num estado "pronto" que só
    // falha na hora da compra, com o log longe da causa.
    expect(iap).toContain('if (!COMPRAS_NO_APP_ATIVAS) return;');
  });

  /**
   * A porta mudou de tela em 08/08: os ajustes saíram do perfil para
   * `app/settings`, atrás da engrenagem. O que este teste protege é o
   * comportamento, não o endereço — "Meu plano" só existe quando há plano.
   */
  it('hides the settings entry point instead of leading to a dead paywall', () => {
    expect(ajustes).toContain('COMPRAS_NO_APP_ATIVAS ? (');
    expect(ajustes).toContain("router.push('/pricing')");
    // E não sobrou nenhuma segunda porta no perfil.
    expect(perfil).not.toContain("router.push('/pricing')");
  });

  it('bounces the paywall even when reached by deep link', () => {
    // A porta da interface some, mas `quibly://pricing` continua resolvendo.
    expect(precos).toContain("if (!COMPRAS_NO_APP_ATIVAS) router.replace('/(tabs)')");
  });

  it('stops reporting paywall_viewed for a paywall nobody can use', () => {
    expect(precos).toContain("if (COMPRAS_NO_APP_ATIVAS) track('paywall_viewed'");
  });
});

/**
 * O guarda que impede religar com chave de mentira. A do Android é literalmente
 * `goog_YOUR_REVENUECAT_ANDROID_KEY` em todos os perfis do `eas.json`.
 */
describe('religar exige chave de verdade', () => {
  it('treats an empty or placeholder key as a configuration error', () => {
    expect(iap).toContain('export function revenueCatConfigError()');
    expect(iap).toContain('_YOUR_');
  });
});
