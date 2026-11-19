// ESLint for the mobile app (CI-02): Expo's flat config (React, React Hooks, React Native, import
// and TypeScript rules) plus the app's own rules. `pnpm -C apps/mobile lint`; the root `pnpm lint`
// and CI run it too.
import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
    expoConfig,
    {
        ignores: [
            'dist/**',
            '.expo/**',
            'android/**',
            'ios/**',
            '**/__tests__/**',
            // Test setup: Babel strips its type annotations for Jest, the ESLint parser does not.
            'jest.setup.js',
            '**/*.test.ts',
            '**/*.test.tsx',
            '**/*.spec.ts',
            '**/*.spec.tsx',
        ],
    },
    {
        rules: {
            // Строго запрещаем прямые console.log/warn/info/debug в приложении
            // Используйте logDebug, logWarn, logError из @/lib/log
            'no-console': ['error', {
                allow: ['error'], // console.error разрешен только в log.ts и logSafe.ts (через eslint-disable/overrides)
            }],
        },
    },
    {
        // The TypeScript plugin of eslint-config-expo applies to TypeScript files only.
        files: ['**/*.ts', '**/*.tsx'],
        rules: {
            // Запрещаем использование any в production коде
            // Используйте конкретные типы или unknown
            '@typescript-eslint/no-explicit-any': ['warn', {
                fixToUnknown: true, // Предлагать замену на unknown
                ignoreRestArgs: false, // Запрещаем any в rest параметрах
            }],
        },
    },
    {
        // Разрешаем console.* только в файлах логирования
        files: ['src/lib/log.ts', 'src/utils/debug.ts'],
        rules: {
            'no-console': 'off',
        },
    },
    {
        // Node configuration files.
        files: ['*.config.js', 'babel.config.js', 'metro.config.js', 'jest.setup.js', 'jest.config.js'],
        languageOptions: { sourceType: 'commonjs' },
    },
]);
