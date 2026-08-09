import { router, type Href } from 'expo-router';

/**
 * Voltar, com destino quando não há de onde voltar.
 *
 * ## O defeito
 *
 * `router.back()` sozinho supõe que existe uma tela anterior. Quando não
 * existe, o Expo Router registra **"The action 'GO_BACK' was not handled by any
 * navigator"** e o toque não faz nada: o botão de fechar simplesmente não
 * fecha.
 *
 * Em desenvolvimento isso vira uma faixa vermelha. Em produção o aviso some — e
 * o defeito fica, mudo, que é a versão pior.
 *
 * ## Quando a pilha está vazia de verdade
 *
 * Não é caso de laboratório. Acontece toda vez que a tela é a **primeira** da
 * sessão:
 *
 * - um convite `tryquibly.com/join/ABC` aberto por quem ainda não abriu o app;
 * - a notificação de mensagem nova, que abre o chat direto;
 * - os botões da Live Activity, que abrem `quibly://session/...`;
 * - e qualquer deep link.
 *
 * Nesses caminhos a pessoa cai numa tela sem saída visível, num app que ela
 * acabou de abrir.
 *
 * ## O destino padrão
 *
 * `/(tabs)` — a lista de salas. É onde alguém que fecha qualquer coisa espera
 * parar, e é a única tela que sempre existe. Quem precisar de outro destino
 * passa o seu.
 */
export function voltar(destino: Href = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  // `replace` e não `push`: a tela que está saindo não deve continuar na pilha
  // esperando um "voltar" que a traria de volta ao beco sem saída.
  router.replace(destino);
}
