// Ensure Metro resolves packages correctly in monorepos with pnpm
// and supports Expo Router web.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('metro-config').MetroConfig} */
module.exports = (async () => {
  const projectRoot = __dirname;
  const workspaceRoot = path.resolve(projectRoot, '../..');
  const config = await getDefaultConfig(projectRoot);

  // Enable unstable_allowRequireContext for expo-router
  config.transformer.unstable_allowRequireContext = true;

  // Include repository root to allow resolving hoisted deps with pnpm
  config.watchFolders = [workspaceRoot];

  // Resolve modules from app and workspace root node_modules
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];

  return config;
})();
