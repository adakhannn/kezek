const nextJest = require('next/jest');

// Unit tests use explicit module mappings below. Passing dir would make Next load
// application configuration and local credentials before the isolated setup runs.
const createJestConfig = nextJest();

const customJestConfig = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testEnvironment: 'jest-environment-node',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@core-domain/(.*)$': '<rootDir>/../../packages/core-domain/src/$1',
        '^@shared-client/(.*)$': '<rootDir>/../../packages/shared-client/src/$1',
        '^next-intl$': '<rootDir>/src/__tests__/mocks/next-intl.ts',
    },
    testMatch: [
        '**/__tests__/**/*.test.[jt]s?(x)',
        '**/?(*.)+(spec|test).[jt]s?(x)',
    ],
    // Separator-agnostic: `<rootDir>/e2e/` does not match Windows paths, which
    // made Jest pick up Playwright specs locally.
    testPathIgnorePatterns: ['[/\\\\]e2e[/\\\\]', '[/\\\\]node_modules[/\\\\]'],
    // Coverage is measured over the whole web source, not a hand-picked allowlist.
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/__tests__/**',
        '!src/**/*.test.{ts,tsx}',
        '!src/generated/**',
        '!src/types/**',
    ],
    testTimeout: 30000,
    // Ratchet: measured on the full suite 2026-11-16 (56.4 / 48.0 / 54.6 / 58.1).
    // Raise these when coverage grows; never lower them to make a change pass.
    coverageThreshold: {
        global: {
            branches: 47,
            functions: 54,
            lines: 57,
            statements: 56,
        },
    },
};

module.exports = createJestConfig(customJestConfig);
