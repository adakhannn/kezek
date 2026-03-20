module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
    },
    testMatch: ['**/__tests__/**/*.unit.test.[jt]s?(x)'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@shared-client/(.*)$': '<rootDir>/../../packages/shared-client/src/$1',
    },
};
