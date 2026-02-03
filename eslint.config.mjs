// eslint.config.mjs — ESLint v9 flat config для монорепы (apps/web)

import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
    // Игнор глобально (замена .eslintignore)
    {
        ignores: [
            '**/node_modules/**',
            '**/.next/**',
            '**/dist/**',
            '**/build/**',
            '**/out/**',
            '**/.turbo/**',
            '**/.vercel/**',
            '**/coverage/**',
            '**/*.log',
            '**/eslint-rules/**', // Исключаем кастомные ESLint правила
        ],
    },

    // Основной набор правил для apps/web
    ...tseslint.config({
        files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
        languageOptions: {
            parser: tseslint.parser,
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                project: './apps/web/tsconfig.json',
                tsconfigRootDir: process.cwd(),
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            import: importPlugin,
            'unused-imports': unusedImports,
            '@next/next': nextPlugin, // ✅ регистрируем плагин
        },
        rules: {
            // База Next (core-web-vitals)
            ...nextPlugin.configs['core-web-vitals'].rules,

            // Наши правки поверх:
            '@next/next/no-html-link-for-pages': 'off', // ✅ в app router не нужен
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'unused-imports/no-unused-imports': 'warn',
            'import/order': ['warn', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
        },
    }),

    // Правила для API routes - проверка использования централизованной обработки ошибок
    {
        files: ['apps/web/src/app/api/**/route.ts'],
        rules: {
            // Предупреждаем о прямом использовании NextResponse.json с ok: false
            // Это не строгое правило, так как миграция постепенная
            // Можно включить как 'error' после полной миграции
            'no-restricted-syntax': [
                'warn',
                {
                    selector: 'CallExpression[callee.object.name="NextResponse"][callee.property.name="json"] > ObjectExpression > Property[key.name="ok"][value.value=false]',
                    message: 'Используйте createErrorResponse() вместо NextResponse.json({ ok: false, ... }). См. ERROR_HANDLING_GUIDE.md',
                },
            ],
        },
    },
];
