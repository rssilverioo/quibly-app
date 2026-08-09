/** @type {import('@bacons/apple-targets/app.plugin').Config} */

/**
 * A tela que aparece quando a pessoa toca num app bloqueado.
 *
 * ## Por que vale uma extensão inteira
 *
 * Sem ela, o sistema mostra o texto padrão: *"Você não pode usar o Instagram
 * porque ele está restrito"*. Quem lê isso no meio do dia não tem como saber
 * que **foi ela mesma** que pediu, quinze minutos atrás, dentro do Quibly — e a
 * conclusão razoável é que o telefone quebrou.
 *
 * Um bloqueio que a pessoa não reconhece como escolha dela deixa de ser foco e
 * vira defeito. A tela diz de onde veio e quanto falta, que é a diferença entre
 * as duas leituras.
 */
module.exports = {
  type: 'shield-config',
  name: 'QuiblyFocoEscudo',
  displayName: 'Quibly Foco',
  bundleIdentifier: '.focoescudo',
  deploymentTarget: '16.0',

  frameworks: ['ManagedSettings', 'ManagedSettingsUI'],

  entitlements: {
    'com.apple.security.application-groups': ['group.com.quibly.app'],
    'com.apple.developer.family-controls': true,
  },
};
