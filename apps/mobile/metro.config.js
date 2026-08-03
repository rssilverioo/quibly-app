const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages in a monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// `apps/web` pede `react: ^19.0.0` e o npm iça a 19.2.8 para a raiz do
// monorepo; `apps/mobile` pina 19.1.0, que acaba aninhado. Com duas cópias no
// mesmo bundle os hooks quebram com "Cannot read property 'useEffect' of null":
// o React que registra o dispatcher não é o mesmo que o componente consome.
//
// Aqui todo `require('react')` do bundle passa a apontar para uma única cópia.
// A correção fica no mobile de propósito — alinhar a versão pela instalação
// exigiria mexer no `apps/web`, que é outro app.
const SINGLETONS = new Set(['react', 'react-dom']);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SINGLETONS.has(moduleName)) {
    return {
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
