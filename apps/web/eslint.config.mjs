import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
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
