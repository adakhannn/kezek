const nextJest = require('next/jest');

const createJestConfig = nextJest({
    dir: './',
});

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
    testPathIgnorePatterns: ['<rootDir>/e2e/', '/node_modules/'],
    collectCoverageFrom: [
        // Real coverage gate for the web unit/service/domain layer that we actively test.
        'src/lib/authContext.ts',
        'src/lib/bizContextResolver.ts',
        'src/lib/bookingDashboardService.ts',
        'src/lib/dashboardBookingsLogic.ts',
        'src/lib/dateUtils.ts',
        'src/lib/i18nHelpers.ts',
        'src/lib/quickBookGuestClient.ts',
        'src/lib/quickBookGuestService.ts',
        'src/lib/quickHoldClient.ts',
        'src/lib/quickHoldService.ts',
        'src/lib/rateLimit.ts',
        'src/lib/repositories.ts',
        'src/lib/serverCancelBookingService.ts',
        'src/lib/visitPackageLogic.ts',
        'src/lib/whatsAppBookingActionService.ts',
        'src/lib/withManagerContext.ts',
        'src/lib/financeDomain/**/*.ts',
        'src/lib/notifications/BookingDataService.ts',
        'src/lib/validation/**/*.ts',
        '!src/lib/**/*.d.ts',
    ],
    testTimeout: 30000,
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
