const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// Expo's default config plus the debug IDs that tie bundles to uploaded source maps (MOB-07).
const config = getSentryExpoConfig(__dirname);

// Keep the mobile entry point local while allowing workspace packages.
config.projectRoot = __dirname;
config.watchFolders = [path.resolve(__dirname, '../..')];

module.exports = config;
