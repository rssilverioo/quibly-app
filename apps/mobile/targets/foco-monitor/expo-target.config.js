/** @type {import('@bacons/apple-targets/app.plugin').Config} */

/**
 * O relógio do sistema que derruba o escudo do foco profundo.
 *
 * ## Por que uma extensão, e não um timer no app
 *
 * É a garantia (2) das quatro descritas em `FocoProfundoModule.swift`, e a
 * única que continua valendo com o **app morto**. Um timer dentro do app morre
 * junto com ele; esta extensão o iOS acorda sozinho no fim da janela agendada.
 *
 * Sem ela, encerrar o Quibly pelo multitarefa no meio de uma sessão deixaria os
 * outros apps bloqueados sem nada marcado para desfazer — o telefone da pessoa
 * preso por um gesto que ela tem todo direito de fazer.
 *
 * ## Por que ela não é suficiente sozinha
 *
 * A Apple recusa janela menor que 15 minutos, então um pomodoro curto nem chega
 * a agendar. E extensão é acordada pelo sistema quando ele quiser — não é
 * promessa de pontualidade. Por isso o app ainda reconcilia na abertura e
 * existe um teto absoluto.
 */
module.exports = {
  type: 'device-activity-monitor',
  name: 'QuiblyFocoMonitor',
  displayName: 'Quibly Foco',
  bundleIdentifier: '.focomonitor',

  // FamilyControls chegou no iOS 16. Abaixo disso a extensão não tem o que
  // fazer, e o app já esconde o recurso.
  deploymentTarget: '16.0',

  frameworks: ['DeviceActivity', 'ManagedSettings'],

  /**
   * O App Group é o único canal com o app.
   *
   * A extensão não enxerga o `UserDefaults.standard` dele. Sem o grupo, ela
   * levantaria e baixaria uma loja de ajustes que o app não conhece — e o
   * escudo que o app pensa ter derrubado continuaria de pé.
   *
   * O `family-controls` precisa estar aqui **também**: sem ele a extensão não
   * tem direito de mexer em `ManagedSettingsStore`, e o `intervalDidEnd` roda
   * sem efeito nenhum. É a forma silenciosa de a garantia (2) não existir.
   */
  entitlements: {
    'com.apple.security.application-groups': ['group.com.quibly.app'],
    'com.apple.developer.family-controls': true,
  },
};
