// The monorepo already owns Jest and SWC in apps/web. Reuse that installed
// toolchain, without loading Next configuration or any application .env files.
const nextJest = require('../../apps/web/node_modules/next/jest');

module.exports = nextJest()({
    rootDir: __dirname,
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
});
