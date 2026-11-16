// Root ESLint config: covers repository tooling only (scripts/, packages/ JS).
// apps/web has its own config (Next 16) and is linted by `pnpm -C apps/web lint`;
// the root `pnpm lint` script runs both.

export default [
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
            'apps/**',
            'docs/**',
            'supabase/**',
        ],
    },
];
