const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Lets @react-native-firebase integrate without static frameworks.
 *
 * The two obvious configurations both fail:
 *
 *  - `use_frameworks! :static` builds the pods as frameworks. RNFirebase's
 *    headers import React-Core headers that belong to no clang module, and
 *    inside a framework module that is an error, not a warning.
 *  - No frameworks at all means the Swift pods Firebase pulls in
 *    (`AppCheckCore`, `FirebaseCoreInternal`) cannot link as static libraries,
 *    because `GoogleUtilities` and `RecaptchaInterop` ship no module map.
 *
 * CocoaPods names the way out in its own error: generate module maps for just
 * those dependencies. Scoped to the two pods rather than a global
 * `use_modular_headers!`, which would change how every pod in the project is
 * compiled and can break unrelated ones.
 *
 * Lives in a config plugin because `expo prebuild` rewrites ios/Podfile from
 * scratch; a hand-edit would disappear on the next regeneration — most likely
 * on someone else's machine or in CI.
 */
const MARKER = '# quibly: module maps for Firebase\'s Swift dependencies';

const PATCH = `
  ${MARKER}
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
`;

module.exports = function withFirebaseModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');

      if (contents.includes(MARKER)) return cfg;

      const anchor = "target 'Quibly' do\n";
      if (!contents.includes(anchor)) {
        throw new Error(
          'withFirebaseModularHeaders: target block not found in Podfile. ' +
            'The target was renamed or the Expo template changed — fix this ' +
            'plugin rather than letting the build silently regress.',
        );
      }

      contents = contents.replace(anchor, anchor + PATCH);
      fs.writeFileSync(podfile, contents);
      return cfg;
    },
  ]);
};
