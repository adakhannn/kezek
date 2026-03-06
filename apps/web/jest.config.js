const nextJest = require('next/jest');

const createJestConfig = nextJest({
    // Путь к Next.js приложению для загрузки next.config.js и .env файлов
    dir: './',
});

// Добавляем кастомную конфигурацию Jest
const customJestConfig = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testEnvironment: 'jest-environment-node',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@core-domain/(.*)$': '<rootDir>/../../packages/core-domain/src/$1',
        '^@shared-client/(.*)$': '<rootDir>/../../packages/shared-client/src/$1',
    },
    testMatch: [
        '**/__tests__/**/*.test.[jt]s?(x)',
        '**/?(*.)+(spec|test).[jt]s?(x)',
    ],
    testPathIgnorePatterns: ['<rootDir>/e2e/', '/node_modules/'],
    collectCoverageFrom: [
        'src/app/api/**/*.ts',
        '!src/app/api/**/*.d.ts',
        '!src/app/api/**/route.ts', // Исключаем route.ts, так как они тестируются через интеграционные тесты
    ],
    testTimeout: 30000, // 30 секунд для API тестов
    // Минимальный порог покрытия тестами (60%+)
    coverageThreshold: {
        global: {
            branches: 60,
            functions: 60,
            lines: 60,
            statements: 60,
        },
    },
};

module.exports = createJestConfig(customJestConfig);

