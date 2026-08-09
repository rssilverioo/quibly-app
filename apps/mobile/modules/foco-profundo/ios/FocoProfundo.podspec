#
# Sem este arquivo o módulo não existe no iOS — e falha calada.
#
# O autolinking da Expo procura um `*.podspec` no diretório do módulo e, se não
# achar nenhum, devolve `null` e segue sem avisar. Foi assim que a Live Activity
# ficou meses sem nunca ser tentada; ver `modules/study-timer/ios/StudyTimer.podspec`.
#
# O nome do pod define o nome do módulo Swift que o `ExpoModulesProvider.swift`
# gerado vai importar, e precisa casar com `ios.modules` do
# `expo-module.config.json`.
#
Pod::Spec.new do |s|
  s.name           = 'FocoProfundo'
  s.version        = '1.0.0'
  s.summary        = 'Bloqueia os outros apps durante a sessão de estudo (iOS).'
  s.description    = 'Módulo nativo local do Quibly. Ver modules/foco-profundo/README.md.'
  s.author         = 'Quibly'
  s.homepage       = 'https://quibly.app'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # FamilyControls, ManagedSettings e DeviceActivity só existem a partir do
  # iOS 16, e o app mira 15.1. O código está atrás de `#if canImport` +
  # `@available(iOS 16.0, *)`, mas o link precisa ser **fraco**: forte, o dyld
  # mata o processo na largada em qualquer aparelho 15.x, e o app nem abre.
  s.weak_frameworks = ['FamilyControls', 'ManagedSettings', 'DeviceActivity']

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
