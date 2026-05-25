/**
 * Jest configuration for React Native / Expo mobile app
 * 
 * Smoke tests for key screens:
 * - Auth screens (SignIn, Verify, WhatsApp)
 * - Shift list (StaffScreen)
 * - Booking details (BookingDetailsScreen, CabinetScreen)
 * - Navigation between booking steps
 */

module.exports = {
    preset: 'react-native',
    transformIgnorePatterns: [
        // Transform react-native and expo (including inside pnpm store)
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase|@tanstack|.pnpm/[^/]+/node_modules/((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?))',
    ],
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
    testEnvironment: 'node',
    globals: {
        'ts-jest': {
            tsconfig: {
                jsx: 'react',
            },
        },
    },
};


