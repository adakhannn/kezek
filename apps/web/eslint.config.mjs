import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      "coverage/**",
      "test-results/**",
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
    },
  },
];

export default eslintConfig;
