const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Desliga a assinatura dos resource bundles dos pods.
 *
 * A partir do Xcode 14 esses bundles são assinados por padrão, e cada um passa
 * a exigir um `DEVELOPMENT_TEAM` próprio — que nenhum pod define. O resultado é
 * `XCODE_RESOURCE_BUNDLE_CODE_SIGNING_ERROR` no meio do archive, com uma
 * mensagem que não diz qual bundle falhou.
 *
 * É o remédio que a própria Expo documenta:
 * https://expo.fyi/r/disable-bundle-resource-signing
 *
 * Feito por plugin, e não editando `ios/Podfile` na mão, porque o Podfile é
 * saída de `prebuild`: a edição manual some no próximo `--clean` e a build
 * volta a quebrar meses depois, sem ninguém lembrar por quê.
 */
const SNIPPET = `
    # Desliga assinatura dos resource bundles dos pods (Xcode 14+).
    # Injetado por plugins/withResourceBundleSigning.js — não editar à mão.
    installer.target_installation_results.pod_target_installation_results
      .each do |pod_name, target_installation_result|
      target_installation_result.resource_bundle_targets.each do |bundle_target|
        bundle_target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        end
      end
    end
`;

module.exports = function withResourceBundleSigning(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');

      if (contents.includes('withResourceBundleSigning')) return cfg;

      // Entra no fim do `post_install` já existente, depois do
      // `react_native_post_install`, para não competir com ele.
      const marker = '    )\n  end';
      const index = contents.indexOf(marker);
      if (index === -1) {
        throw new Error(
          '[withResourceBundleSigning] Não encontrei o post_install esperado no Podfile.',
        );
      }

      const insertAt = index + '    )\n'.length;
      contents = contents.slice(0, insertAt) + SNIPPET + contents.slice(insertAt);
      fs.writeFileSync(podfile, contents);

      return cfg;
    },
  ]);
};
