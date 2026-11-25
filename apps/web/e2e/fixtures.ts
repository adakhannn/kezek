import { test as base, type Page } from '@playwright/test';

export { expect } from '@playwright/test';
export type { Browser, Locator, Page, StorageState } from '@playwright/test';

/**
 * Resolves once React has hydrated the document. Under `next dev` a click that lands before
 * hydration has no handler and is lost, so the specs navigate with this wait.
 */
export async function waitForHydration(page: Page): Promise<void> {
    await page.waitForFunction(
        () => !!document.body && Object.keys(document.body).some((key) => key.startsWith('__reactFiber') || key.startsWith('__reactProps')),
        undefined,
        { timeout: 30_000 },
    );
    await page.waitForLoadState('networkidle').catch(() => undefined);
}

/** `test` whose `page.goto` / `page.reload` also wait for hydration. */
export const test = base.extend({
    page: async ({ page }, use) => {
        const goto = page.goto.bind(page);
        const reload = page.reload.bind(page);
        page.goto = async (url, options) => {
            const response = await goto(url, options);
            await waitForHydration(page);
            return response;
        };
        page.reload = async (options) => {
            const response = await reload(options);
            await waitForHydration(page);
            return response;
        };
        await use(page);
    },
});
