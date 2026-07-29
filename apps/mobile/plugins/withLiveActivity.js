const fs = require('fs');
const path = require('path');
const {
  withInfoPlist,
  withXcodeProject,
  withDangerousMod,
} = require('@expo/config-plugins');

/**
 * Cria a Widget Extension que renderiza a Live Activity da sessão de estudo.
 *
 * ## Por que isto precisa ser um plugin
 *
 * Uma Live Activity não é um arquivo Swift solto — é um *target* do Xcode, com
 * Info.plist, entitlements e build phases próprias. E `apps/mobile/ios` é saída
 * de `expo prebuild`: qualquer coisa criada à mão lá desaparece no próximo
 * `--clean`. Um passo manual que precisa ser lembrado é um passo que uma hora
 * não é lembrado, e aí a Live Activity some de uma build de produção sem
 * ninguém notar.
 *
 * ## O risco conhecido, dito antes de você descobrir sozinho
 *
 * `StudyTimerAttributes.swift` é compilado duas vezes: no app (via o Pod do
 * módulo Expo) e aqui, na extensão. O ActivityKit casa os dois lados pelo
 * *nome* do tipo, não pelo módulo, então na prática funciona — é o arranjo que
 * a maioria dos projetos usa. Mas é frágil: se as duas cópias divergirem em um
 * campo, o sistema recusa a atividade em silêncio, sem erro de compilação.
 *
 * A alternativa robusta é um framework compartilhado entre os dois targets, que
 * é bem mais encanamento. Não fiz porque não tenho como compilar e comparar os
 * dois caminhos. Se a Live Activity não aparecer no aparelho, **este é o
 * primeiro lugar para olhar.**
 *
 * Nada disto foi executado. Ver `modules/study-timer/README.md`.
 */

const TARGET_NAME = 'QuiblyWidget';
const BUNDLE_SUFFIX = '.widget';
/** Live Activities exigem 16.1; a extensão não pode mirar mais baixo. */
const DEPLOYMENT_TARGET = '16.1';

/** Fontes que a extensão compila. Copiadas do módulo no prebuild. */
const SOURCES = [
  'StudyTimerAttributes.swift',
  'CasteloMark.swift',
  'StudyTimerLiveActivity.swift',
];

function widgetInfoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Quibly</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>
`;
}

/** Escreve as fontes e o Info.plist da extensão dentro de `ios/QuiblyWidget`. */
const withWidgetFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const widgetDir = path.join(iosRoot, TARGET_NAME);
      const moduleIos = path.join(
        cfg.modRequest.projectRoot,
        'modules',
        'study-timer',
        'ios',
      );

      fs.mkdirSync(widgetDir, { recursive: true });
      fs.writeFileSync(path.join(widgetDir, 'Info.plist'), widgetInfoPlist());

      for (const file of SOURCES) {
        const from = path.join(moduleIos, file);
        if (!fs.existsSync(from)) {
          throw new Error(
            `[withLiveActivity] Fonte ausente: ${from}. ` +
              'A extensão não compila sem ela.',
          );
        }
        fs.copyFileSync(from, path.join(widgetDir, file));
      }

      return cfg;
    },
  ]);

/**
 * `NSSupportsLiveActivities` no app principal. Sem esta chave o
 * `Activity.request` falha em runtime, sem erro de compilação — o tipo de falha
 * que só aparece no aparelho.
 */
const withLiveActivityFlag = (config) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.NSSupportsLiveActivities = true;
    return cfg;
  });

const withWidgetTarget = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;

    // Idempotente: `prebuild` roda mais de uma vez, e duplicar o target
    // corromperia o pbxproj.
    if (project.pbxTargetByName(TARGET_NAME)) return cfg;

    const appBundleId = cfg.ios?.bundleIdentifier;
    if (!appBundleId) {
      throw new Error('[withLiveActivity] ios.bundleIdentifier não definido.');
    }

    const group = project.addPbxGroup(
      [...SOURCES, 'Info.plist'],
      TARGET_NAME,
      TARGET_NAME,
    );

    // Pendura o grupo na raiz do projeto, senão os arquivos não aparecem no
    // navegador do Xcode nem entram na build.
    const groups = project.hash.project.objects.PBXGroup;
    for (const key of Object.keys(groups)) {
      if (groups[key].name === undefined && groups[key].path === undefined && groups[key].children) {
        project.addToPbxGroup(group.uuid, key);
        break;
      }
    }

    const target = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME);

    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase(
      ['WidgetKit.framework', 'SwiftUI.framework'],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      target.uuid,
    );

    for (const file of SOURCES) {
      project.addSourceFile(
        `${TARGET_NAME}/${file}`,
        { target: target.uuid },
        group.uuid,
      );
    }

    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings;
      if (!buildSettings || buildSettings.PRODUCT_NAME !== `"${TARGET_NAME}"`) continue;

      buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${appBundleId}${BUNDLE_SUFFIX}"`;
      buildSettings.IPHONEOS_DEPLOYMENT_TARGET = `"${DEPLOYMENT_TARGET}"`;
      buildSettings.INFOPLIST_FILE = `"${TARGET_NAME}/Info.plist"`;
      buildSettings.SWIFT_VERSION = '"5.0"';
      buildSettings.TARGETED_DEVICE_FAMILY = '"1"';
      // A extensão precisa ser assinada com o mesmo time do app; deixar em
      // branco faz a build do EAS falhar com um erro de assinatura opaco.
      buildSettings.CODE_SIGN_STYLE = '"Automatic"';
      buildSettings.SKIP_INSTALL = '"NO"';
    }

    return cfg;
  });

module.exports = function withLiveActivity(config) {
  return withWidgetTarget(withWidgetFiles(withLiveActivityFlag(config)));
};
