import { Platform } from 'react-native';

/**
 * Ligar os anúncios — na ordem que a Apple exige.
 *
 * ## Por que a permissão vem antes da inicialização
 *
 * O SDK do AdMob lê o identificador de publicidade quando inicializa. No iOS,
 * ler esse identificador **antes** de a pessoa aprovar o rastreamento é
 * violação de política — e, na prática, devolve um identificador zerado que não
 * volta atrás nesta execução. Inicializar primeiro não dá erro: dá anúncio não
 * personalizado para sempre, calado.
 *
 * ## Por que não no primeiro segundo do app
 *
 * A Apple recomenda pedir em contexto, e a recusa é irreversível — quem nega
 * uma vez só muda nos Ajustes. Pedir na abertura, antes de a pessoa saber o que
 * o app é, é a forma mais rápida de conseguir um "não" permanente.
 *
 * Por isso quem chama isto é a **primeira tela com faixa**, e não o `_layout`.
 *
 * ## Por que só uma vez
 *
 * `requestTrackingPermissionsAsync` reabre a folha do sistema se o estado ainda
 * for indeterminado, e `initialize` é idempotente mas custa. A trava é de
 * processo: se o app morre, tudo bem recomeçar.
 */

let ligando: Promise<void> | null = null;

export function ligarAnuncios(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return Promise.resolve();
  if (ligando) return ligando;

  ligando = (async () => {
    try {
      if (Platform.OS === 'ios') {
        const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
        // O resultado não é conferido de propósito: negado também segue, e o
        // AdMob passa a servir anúncio não personalizado sozinho. Bloquear o
        // anúncio por causa da recusa punia quem recusou — e a recusa é
        // legítima.
        await requestTrackingPermissionsAsync();
      }
      const { default: mobileAds } = await import('react-native-google-mobile-ads');
      await mobileAds().initialize();
    } catch {
      // Sem SDK linkado, sem anúncio. Ver `FaixaDeAnuncio`.
    }
  })();

  return ligando;
}
