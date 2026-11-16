// Single ESLint config for apps/web (Next 16). The repository root config only
// covers root tooling; `pnpm lint` at the root runs both.
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const kezekPlugin = {
  rules: {
    "no-service-role-env": {
      meta: {
        type: "problem",
        messages: {
          direct: "Не читайте SUPABASE_SERVICE_ROLE_KEY напрямую: используйте getServiceClient() / createSupabaseAdminClient() или isSupabaseServiceRoleConfigured() из @/lib/env.",
        },
        schema: [],
      },
      create(context) {
        return {
          MemberExpression(node) {
            const key = node.computed ? node.property.value : node.property.name;
            const obj = node.object;
            if (key === "SUPABASE_SERVICE_ROLE_KEY" && obj.type === "MemberExpression"
              && obj.object.type === "Identifier" && obj.object.name === "process"
              && !obj.computed && obj.property.name === "env") {
              context.report({ node, messageId: "direct" });
            }
          },
        };
      },
    },
  },
};

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
      // No autofix to `unknown`: `eslint --fix` (lint-staged) must not change
      // types silently — that breaks typecheck in the pre-commit hook.
      "@typescript-eslint/no-explicit-any": ["warn", {
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
  {
    // Service role (bypasses RLS) is reachable only through lib/env.ts and the
    // client factories in lib/supabaseHelpers.ts / lib/supabaseService.ts.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/env.ts", "src/__tests__/**"],
    plugins: { kezek: kezekPlugin },
    rules: {
      "kezek/no-service-role-env": "error",
    },
  },
  {
    // App code (pages, layouts, route handlers) uses the shared factories instead
    // of constructing Supabase clients. The Google callback writes auth cookies
    // itself and is the one documented exception.
    files: ["src/app/**/*.{ts,tsx}"],
    ignores: ["src/app/auth/callback/google/route.ts", "src/**/__tests__/**", "src/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "@supabase/ssr", message: "Используйте createSupabaseServerClient() из @/lib/supabaseHelpers." },
          { name: "@supabase/supabase-js", importNames: ["createClient"], message: "Используйте фабрики из @/lib/supabaseHelpers (createSupabaseAdminClient / createSupabaseAnonClient)." },
        ],
      }],
    },
  },
];

export default eslintConfig;
