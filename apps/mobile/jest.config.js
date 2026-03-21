/**
 * Jest configuration for React Native / Expo mobile app
 * 
 * Smoke tests for key screens:
 * - Auth screens (SignIn, SignUp, Verify, WhatsApp)
 * - Shift list (StaffScreen)
 * - Booking details (BookingDetailsScreen, CabinetScreen)
 * - Navigation between booking steps
 */

module.exports = {
    preset: 'jest-expo',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testMatch: [
        '**/__tests__/**/*.test.[jt]s?(x)',
        '**/?(*.)+(spec|test).[jt]s?(x)',
    ],
    collectCoverageFrom: [
        'src/screens/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
        'src/navigation/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.stories.{ts,tsx}',
    ],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@shared-client/(.*)$': '<rootDir>/../../packages/shared-client/src/$1',
    },
    globals: {
        'ts-jest': {
            tsconfig: {
                jsx: 'react',
            },
        },
    },
};

