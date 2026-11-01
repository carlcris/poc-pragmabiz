const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Login contracts and translations are shared with the web application.
config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, "../../src/lib/auth"),
  path.resolve(__dirname, "../../src/lib/i18n"),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@": path.resolve(__dirname, "src"),
};

module.exports = config;
