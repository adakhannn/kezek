/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: 'src',
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleNameMapper: {},
    collectCoverageFrom: ['booking/**/*.ts', '!booking/**/__tests__/**', '!**/*.d.ts'],
};
