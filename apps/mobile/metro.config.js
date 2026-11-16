const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Login contracts, translations, and item/batch QR helpers are shared with the web application.
config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, "../../src/lib"),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@": path.resolve(__dirname, "src"),
};

module.exports = config;
