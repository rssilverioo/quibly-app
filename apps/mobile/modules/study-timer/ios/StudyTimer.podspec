#
# Sem este arquivo o módulo não existe no iOS — e falha calada.
#
# O autolinking da Expo procura um `*.podspec` no diretório do módulo e, se não
# achar nenhum, devolve `null` e segue em frente sem avisar
# (`expo-modules-autolinking/build/platforms/apple/apple.js`, `resolveModuleAsync`:
# `if (!podspecFiles.length) return null`). Nenhum warning, nenhum erro de
# build: o Swift daqui simplesmente nunca entra no app.
#
# A consequência atravessa três camadas até virar silêncio total:
#
#   sem podspec  →  `requireNativeModule('StudyTimer')` lança
#                →  `resolve()` em src/index.ts devolve null
#                →  `isAvailable === false`
#                →  todo `if (!StudyTimer) return` em services/study-timer.ts
#                   retorna antes de tocar no ActivityKit.
#
# Ou seja: a Live Activity não falhava, ela nunca era sequer tentada. O Android
# estava linkado o tempo todo (via `android/build.gradle`, que o autolinking
# encontra por outro caminho), o que fez o bug parecer específico do iOS quando
# na verdade era a ausência de um arquivo de 20 linhas.
#
# O nome do pod define o nome do módulo Swift que o `ExpoModulesProvider.swift`
# gerado vai importar. Tem que ser `StudyTimer`, para casar com o
# `ios.modules: ["StudyTimerModule"]` de `expo-module.config.json`.
#
Pod::Spec.new do |s|
  s.name           = 'StudyTimer'
  s.version        = '1.0.0'
  s.summary        = 'Live Activity da sessão de estudo (iOS) / foreground service (Android).'
  s.description    = 'Módulo nativo local do Quibly. Ver modules/study-timer/README.md.'
  s.author         = 'Quibly'
  s.homepage       = 'https://quibly.app'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # ActivityKit só existe a partir do iOS 16.1, e o app mira 15.1. As chamadas
  # já estão atrás de `#if canImport(ActivityKit)` + `@available(iOS 16.1, *)`,
  # mas o link precisa ser fraco para o app abrir em 15.x — senão o dyld mata o
  # processo na largada por framework ausente.
  s.weak_frameworks = ['ActivityKit', 'WidgetKit']

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  # Relativo a este diretório, então pega `StudyTimerModule.swift` e
  # `StudyTimerAttributes.swift` — e **não** alcança `../widget/`, que declara
  # `@main` e sequestraria o processo do app se fosse compilado aqui
  # (ver o comentário de SOURCES em plugins/withLiveActivity.js).
  s.source_files = '**/*.{h,m,swift}'
end
