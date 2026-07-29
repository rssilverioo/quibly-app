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
 * é bem mais encanamento. Se a Live Activity não aparecer no aparelho, **este é
 * o primeiro lugar para olhar.**
 *
 * ## O que foi verificado
 *
 * `expo prebuild -p ios` gera o target, e
 * `xcodebuild -scheme QuiblyWidget -sdk iphonesimulator` compila e produz o
 * `.appex`. Ou seja: o pbxproj é válido e o Swift compila.
 *
 * O que isso **não** prova é que a Live Activity aparece — para isso é preciso
 * um aparelho. Ver `modules/study-timer/README.md`.
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

    // `addTarget` já cria o grupo do target, a referência do produto e a
    // entrada em Products. Criar um `addPbxGroup` por cima disso produzia dois
    // grupos com o mesmo nome e o `.appex` duplicado em Products — o Xcode
    // chama isso de "malformed project" e ainda assim compila, que é a pior
    // combinação possível: quebra em outro lugar, muito depois.
    const target = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME);

    // Deduplicar AGORA, antes de pendurar qualquer coisa. A ordem importa: se
    // o dedupe rodar no fim, ele apaga um target que as build phases e a
    // dependência já referenciam, e o projeto fica com ponteiros para o nada —
    // a EAS falha com "Could not find target with id 'undefined'", que não diz
    // absolutamente nada sobre a causa. Mantém-se o target que `addTarget`
    // devolveu, porque é o único cujo uuid o resto deste código conhece.
    dedupeNativeTargets(project, TARGET_NAME, target.uuid);

    const groups = project.hash.project.objects.PBXGroup;
    const groupUuid = Object.keys(groups).find(
      (key) => groups[key].name === TARGET_NAME || groups[key].path === TARGET_NAME,
    );
    if (!groupUuid) {
      throw new Error('[withLiveActivity] addTarget não criou o grupo esperado.');
    }
    const group = { uuid: groupUuid };

    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase(
      ['WidgetKit.framework', 'SwiftUI.framework'],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      target.uuid,
    );

    // Só o nome do arquivo. O grupo já tem `path = QuiblyWidget`, e o Xcode
    // resolve relativo a ele — prefixar aqui produzia
    // `QuiblyWidget/QuiblyWidget/Foo.swift` e a build falhava com
    // "Build input files cannot be found".
    for (const file of SOURCES) {
      project.addSourceFile(file, { target: target.uuid }, group.uuid);
    }

    // O time de assinatura vem do target do app, não hardcodado: EAS injeta
    // credenciais só no target principal, e uma extensão sem DEVELOPMENT_TEAM
    // não assina — a build morre com um erro de assinatura que não menciona a
    // extensão em lugar nenhum. Lendo daqui, os dois nunca divergem.
    // `addTarget` registra o produto em Products, e a phase de embed cria uma
    // segunda referência ao mesmo `.appex`. As duas acabam listadas em
    // Products, o que o Xcode reporta como projeto malformado. Fica só a
    // referência de produto do target.
    // Sem isto o Xcode não sabe que o app depende da extensão: ele agenda a
    // phase de embed sem ter construído o `.appex`, e a build morre num
    // "Copy" de um arquivo que ainda não existe. `addTarget` cria a phase de
    // embed mas não a dependência — é preciso declarar.
    // `addTargetDependency` grava nas seções PBXTargetDependency e
    // PBXContainerItemProxy — que não existem num projeto que nunca teve
    // dependência entre targets, como este. Sem criá-las antes, a chamada
    // estoura num TypeError que a Expo engole, e o prebuild termina dizendo
    // "Finished" com o projeto pela metade.
    const objects = project.hash.project.objects;
    objects.PBXTargetDependency = objects.PBXTargetDependency || {};
    objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};

    const appTarget = project.getFirstTarget();
    if (appTarget?.uuid) {
      project.addTargetDependency(appTarget.uuid, [target.uuid]);
    }

    dedupeProductsGroup(project, target);
    // O guard no topo cobre reexecuções do `prebuild`, mas não a ordem em que
    // a Expo aplica os mods dentro de uma única execução — na prática o mod
    // roda duas vezes e produz dois targets com o mesmo nome. Um projeto com
    // target duplicado ainda compila localmente e quebra no EAS, que é o pior
    // modo de falha possível. Idempotência por construção, então.
    dedupeEmbedPhases(project);

    const configurations = project.pbxXCBuildConfigurationSection();
    let developmentTeam;
    for (const key of Object.keys(configurations)) {
      const settings = configurations[key].buildSettings;
      if (settings?.DEVELOPMENT_TEAM && settings.PRODUCT_NAME !== `"${TARGET_NAME}"`) {
        developmentTeam = settings.DEVELOPMENT_TEAM;
        break;
      }
    }

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
      if (developmentTeam) buildSettings.DEVELOPMENT_TEAM = developmentTeam;
    }

    return cfg;
  });

/**
 * Mantém um único `PBXNativeTarget` com este nome, e limpa a lista de targets
 * do projeto. O primeiro vence — é o que tem as build phases e os arquivos.
 */
function dedupeNativeTargets(project, name, keepUuid) {
  // Os nomes chegam aqui entre aspas (`"QuiblyWidget"`) enquanto o projeto está
  // em memória, e sem aspas depois de escrito e relido. Comparar cru falha
  // silenciosamente — e um dedupe que não dedupa é pior que nenhum.
  const unquote = (value) => String(value ?? '').replace(/^"|"$/g, '');
  const section = project.pbxNativeTargetSection();
  const uuids = Object.keys(section).filter(
    (key) => !key.endsWith('_comment') && unquote(section[key]?.name) === name,
  );
  if (uuids.length <= 1) return;

  const keep = uuids.includes(keepUuid) ? keepUuid : uuids[0];
  const extras = uuids.filter((uuid) => uuid !== keep);
  for (const uuid of extras) {
    delete section[uuid];
    delete section[`${uuid}_comment`];
  }

  const projectSection = project.pbxProjectSection();
  for (const key of Object.keys(projectSection)) {
    const targets = projectSection[key]?.targets;
    if (!Array.isArray(targets)) continue;
    projectSection[key].targets = targets.filter(
      (entry) => !extras.includes(entry.value),
    );
  }

  return keep;
}

/**
 * Mantém uma única phase de embed no target do app.
 *
 * Como `addTarget` acaba rodando duas vezes, o app fica com duas phases
 * "Copy Files" copiando o mesmo `.appex` para o mesmo destino. Dois comandos
 * com a mesma saída é exatamente a definição de ciclo para o Xcode:
 *
 *   error: Cycle inside Quibly; building could produce unreliable results.
 *
 * E o ciclo só aparece na build do app inteiro — construir o scheme do widget
 * sozinho passa. Foi por isso que passou despercebido até a build remota.
 */
function dedupeEmbedPhases(project) {
  const copySection = project.hash.project.objects.PBXCopyFilesBuildPhase || {};
  const appTarget = project.getFirstTarget();
  const target = project.pbxNativeTargetSection()[appTarget?.uuid];
  if (!target?.buildPhases) return;

  const PLUGINS_DIR = 13;
  const drop = new Set();
  let kept = false;

  for (const phase of target.buildPhases) {
    const body = copySection[phase.value];
    if (!body || Number(body.dstSubfolderSpec) !== PLUGINS_DIR) continue;

    // Uma das duas passagens deixa a phase vazia. Uma phase de embed sem
    // arquivo não copia nada e só serve para confundir o grafo de build.
    if (!body.files || body.files.length === 0) {
      drop.add(phase.value);
      delete copySection[phase.value];
      delete copySection[`${phase.value}_comment`];
      continue;
    }

    // A outra recebe o mesmo `.appex` duas vezes. Dois comandos de cópia com
    // a mesma saída é, para o Xcode, literalmente um ciclo:
    //   error: Cycle inside Quibly; building could produce unreliable results.
    const seenFiles = new Set();
    body.files = body.files.filter((file) => {
      if (seenFiles.has(file.comment)) return false;
      seenFiles.add(file.comment);
      return true;
    });

    // E sobra no máximo uma phase de embed no target.
    if (kept) {
      drop.add(phase.value);
      delete copySection[phase.value];
      delete copySection[`${phase.value}_comment`];
    } else {
      kept = true;
    }
  }

  if (drop.size > 0) {
    target.buildPhases = target.buildPhases.filter((ph) => !drop.has(ph.value));
  }

  positionEmbedPhase(project, target, copySection);
}

/**
 * Coloca a phase de embed logo depois de "Resources".
 *
 * Com ela no fim — que é onde o Xcode normalmente põe — a build entra em ciclo
 * neste projeto:
 *
 *   embed copia o .appex para dentro de Quibly.app
 *     → depende do script "[CP-User] [RNFB] Core Configuration"
 *     → que declara Quibly.app/Info.plist como saída
 *     → cuja produção depende do embed
 *
 * O react-native-firebase declara o Info.plist do app como output do script
 * dele, e o Xcode ordena qualquer escrita dentro do bundle em relação a isso.
 * Rodando o embed antes do script, a corrente se abre.
 *
 * Ancorado em "Resources", não num índice fixo: a lista de phases muda com o
 * que o CocoaPods injeta, e um índice cru quebraria no próximo pod novo.
 */
function positionEmbedPhase(project, target, copySection) {
  const PLUGINS_DIR = 13;
  const embedIndex = target.buildPhases.findIndex((ph) => {
    const body = copySection[ph.value];
    return body && Number(body.dstSubfolderSpec) === PLUGINS_DIR;
  });
  if (embedIndex === -1) return;

  const resourcesIndex = target.buildPhases.findIndex(
    (ph) => ph.comment === 'Resources',
  );
  if (resourcesIndex === -1 || embedIndex === resourcesIndex + 1) return;

  const [embed] = target.buildPhases.splice(embedIndex, 1);
  const anchor = target.buildPhases.findIndex((ph) => ph.comment === 'Resources');
  target.buildPhases.splice(anchor + 1, 0, embed);
}

/** Remove referências duplicadas ao `.appex` do grupo Products. */
function dedupeProductsGroup(project, target) {
  const groups = project.hash.project.objects.PBXGroup;
  const productsUuid = Object.keys(groups).find((key) => groups[key].name === 'Products');
  if (!productsUuid) return;

  const keep = target.pbxNativeTarget?.productReference;
  const seen = new Set();
  groups[productsUuid].children = groups[productsUuid].children.filter((child) => {
    if (!child.comment?.endsWith('.appex')) return true;
    if (child.value === keep) {
      seen.add(child.comment);
      return true;
    }
    // Uma segunda referência ao mesmo produto: descarta.
    return !seen.has(child.comment) && (seen.add(child.comment), false);
  });
}

/**
 * ## Estado: DESLIGADO por padrão. Ligue com QUIBLY_LIVE_ACTIVITY=1.
 *
 * Criar o target da extensão manipulando o `.pbxproj` não fechou. Foram
 * corrigidos, em ordem, um target duplicado, duas phases de embed, um `.appex`
 * duplicado em Products, uma dependência ausente, seções PBX que não existiam,
 * e um ciclo de build com o script do react-native-firebase. A build local do
 * workspace inteiro chegou a passar.
 *
 * O que não fecha é mais fundo: a Expo aplica este mod duas vezes por prebuild,
 * e as duas passagens não enxergam uma à outra. Cada uma cria o seu target e
 * escreve por cima da outra, então a dependência gravada aponta para um target
 * que não está no arquivo final. A EAS morre com "Could not find target with id
 * 'undefined'". Deduplicar depois não resolve, porque o problema não é o
 * resultado — é que há dois resultados.
 *
 * A saída certa não é continuar operando o pbxproj na mão: é `@bacons/apple-
 * targets`, o plugin que a comunidade mantém exatamente para isto e que já
 * lida com esse ciclo de vida. Fica como próximo passo.
 *
 * Enquanto isso, ligar isto quebra **toda** a build de iOS, não só a Live
 * Activity. E o produto não depende dela: o cronômetro é medido no servidor, a
 * sessão sobrevive por causa do heartbeat, e no iOS a Live Activity sempre foi
 * mostrador, nunca mecanismo (ver modules/study-timer/README.md). Sem ela o
 * usuário perde o cronômetro na tela de bloqueio e não perde um minuto de
 * estudo. Bloquear o release por causa disso seria trocar o essencial pelo
 * acessório.
 *
 * O Swift do widget continua no repo, compilando e testado — `CasteloMark`,
 * `StudyTimerAttributes` e `StudyTimerLiveActivity` passam por `swiftc
 * -typecheck`, e há uma prévia do desenho. Só a criação do target está parada.
 */
const ENABLED = process.env.QUIBLY_LIVE_ACTIVITY === '1';

module.exports = function withLiveActivity(config) {
  if (!ENABLED) return config;
  return withWidgetTarget(withWidgetFiles(withLiveActivityFlag(config)));
};
