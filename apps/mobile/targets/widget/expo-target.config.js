/** @type {import('@bacons/apple-targets/app.plugin').Config} */

/**
 * A Widget Extension que renderiza a Live Activity da sessão de estudo.
 *
 * ## Por que este arquivo substituiu `plugins/withLiveActivity.js`
 *
 * O plugin caseiro criava o target manipulando o `.pbxproj` na mão, e não
 * fechou. Depois de corrigir target duplicado, duas phases de embed, `.appex`
 * duplicado, dependência ausente, seções PBX inexistentes e um ciclo de build
 * com o react-native-firebase, sobrou um defeito mais fundo: **a Expo aplica o
 * mod duas vezes por prebuild, e as duas passagens não se enxergam.** Cada uma
 * criava o seu target e escrevia por cima da outra, então a dependência gravada
 * apontava para um target ausente do arquivo final e a EAS morria com
 * `Could not find target with id 'undefined'`.
 *
 * Deduplicar depois não resolvia, porque o problema não era o resultado — era
 * haver dois. Por isso o plugin ficou **desligado** atrás de
 * `QUIBLY_LIVE_ACTIVITY=1`, e por isso a Live Activity nunca esteve em build
 * nenhuma: o Swift existia, compilava, e o target nunca era criado.
 *
 * `@bacons/apple-targets` é o plugin que a comunidade mantém exatamente para
 * isto e que lida com esse ciclo de vida — a saída que o próprio arquivo antigo
 * já apontava como o próximo passo.
 *
 * ## O que este alvo NÃO faz
 *
 * Uma Live Activity no iOS é **mostrador, não mecanismo**. Ela não mantém o app
 * vivo nem o heartbeat batendo; o iOS não oferece isso para este tipo de app.
 * Quem mede a sessão e a credita até o último batimento é o servidor
 * (`modules/study-timer/README.md`). Sem o widget o usuário perde o cronômetro
 * na tela de bloqueio e não perde um minuto de estudo.
 */
module.exports = {
  type: 'widget',
  name: 'QuiblyWidget',
  displayName: 'Quibly',

  // `.widget` vira `com.quibly.app.widget`: o ponto inicial faz o plugin
  // pendurar no bundle do app, em vez de inventar um id paralelo.
  bundleIdentifier: '.widget',

  // Live Activities exigem 16.1. O padrão do plugin é 18.0, que excluiria
  // aparelho em uso sem necessidade.
  deploymentTarget: '16.1',

  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
};
