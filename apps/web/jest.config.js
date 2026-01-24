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
    },
    testMatch: [
        '**/__tests__/**/*.test.[jt]s?(x)',
        '**/?(*.)+(spec|test).[jt]s?(x)',
    ],
    collectCoverageFrom: [
        'src/app/api/**/*.ts',
        '!src/app/api/**/*.d.ts',
        '!src/app/api/**/route.ts', // Исключаем route.ts, так как они тестируются через интеграционные тесты
    ],
    testTimeout: 30000, // 30 секунд для API тестов
};

module.exports = createJestConfig(customJestConfig);

