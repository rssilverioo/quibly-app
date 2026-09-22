import { Platform } from 'react-native';

/**
 * O SDK da Meta — só para tráfego pago.
 *
 * ## O que ele faz aqui, e o que não faz
 *
 * Faz: registra a **instalação** e a **abertura** do app, que é o que uma
 * campanha de instalação da Meta precisa para otimizar e atribuir. Isso os
 * eventos automáticos do SDK já cobrem; não há chamada nossa para eles.
 *
 * Não faz: compra. O RevenueCat manda o evento de compra para a Meta pela
 * integração servidor-a-servidor, com o valor real cobrado pela loja. Logar
 * a compra também aqui contaria duas vezes.
 *
 * ## Por que inicializa depois do ATT
 *
 * `isAutoInitEnabled` está desligado no `app.json`. No iOS, o SDK só pode
 * usar o identificador de publicidade depois que a pessoa respondeu à folha
 * de rastreamento, e a resposta tem que ser repassada com
 * `setAdvertiserTrackingEnabled`. Quem chama isto é `ligarAnuncios`, no mesmo
 * lugar em que o AdMob espera o ATT — uma folha só, uma resposta só, dois
 * SDKs avisados.
 *
 * ## Por que não quebra sem o SDK
 *
 * No Expo Go e em builds sem o módulo nativo o `import` falha; o app segue
 * sem atribuição, que é o comportamento certo para desenvolvimento.
 */
export async function ligarMeta(rastreamentoAutorizado: boolean): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    const { Settings } = await import('react-native-fbsdk-next');
    if (Platform.OS === 'ios') {
      await Settings.setAdvertiserTrackingEnabled(rastreamentoAutorizado);
    }
    Settings.initializeSDK();
  } catch {
    // Sem módulo nativo, sem atribuição.
  }
}
