// Single ESLint config for apps/web (Next 16). The repository root config only
// covers root tooling; `pnpm lint` at the root runs both.
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "jest.config.js",
      "jest.setup.js",
      "e2e/**",
      "playwright.config.ts",
    ],
  },
  {
    rules: {
      // Строго запрещаем прямые console.log/warn/info/debug в приложении
      // Используйте logDebug, logWarn, logError из @/lib/log
      "no-console": ["error", {
        allow: ["error"] // console.error разрешен только в log.ts и logSafe.ts (через eslint-disable/overrides)
      }],
      // Запрещаем использование any в production коде
      // Используйте конкретные типы или unknown
      "@typescript-eslint/no-explicit-any": ["warn", {
        fixToUnknown: true, // Предлагать замену на unknown
        ignoreRestArgs: false, // Запрещаем any в rest параметрах
      }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // App Router: правило для pages/ не применимо
      "@next/next/no-html-link-for-pages": "off",
      "import/order": ["warn", { "newlines-between": "always", alphabetize: { order: "asc" } }],
    },
  },
  {
    // API routes должны использовать централизованные ответы (см. ERROR_HANDLING_GUIDE.md)
    files: ["src/app/api/**/route.ts"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: 'CallExpression[callee.object.name="NextResponse"][callee.property.name="json"] > ObjectExpression > Property[key.name="ok"][value.value=false]',
          message: "Используйте createErrorResponse() вместо NextResponse.json({ ok: false, ... }). См. ERROR_HANDLING_GUIDE.md",
        },
      ],
    },
  },
];

export default eslintConfig;
