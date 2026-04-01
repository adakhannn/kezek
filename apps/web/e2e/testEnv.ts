import { test } from '@playwright/test';

export function getBaseUrl(): string {
    return process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
}

export function missingE2EEnv(names: string[]): string[] {
    return names.filter((name) => {
        const value = process.env[name];
        return typeof value !== 'string' || value.trim().length === 0;
    });
}

export function formatMissingEnvMessage(scope: string, names: string[]): string {
    return `${scope} requires configured env vars: ${names.join(', ')}`;
}

export function readRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value || value.trim().length === 0) {
        throw new Error(`Missing required E2E env: ${name}`);
    }
    return value;
}

export function skipIfMissingE2EEnv(scope: string, names: string[]): void {
    const missing = missingE2EEnv(names);
    if (missing.length > 0) {
        // Playwright treats this as a suite-level skip when called during spec evaluation.
        // eslint-disable-next-line playwright/no-skipped-test
        test.skip(true, formatMissingEnvMessage(scope, missing));
    }
}
