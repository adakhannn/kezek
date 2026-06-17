const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep the mobile entry point local while allowing workspace packages.
config.projectRoot = __dirname;
config.watchFolders = [path.resolve(__dirname, '../..')];

module.exports = config;
