import { expect, type Browser, type Page, type StorageState } from '@playwright/test';

const EMAIL_INPUT_SELECTOR = 'input[type="email"], input[name="email"]';
const PASSWORD_INPUT_SELECTOR = 'input[type="password"], input[name="password"]';
const EMAIL_SUBMIT_SELECTOR =
    'button:has-text("Отправить"), button:has-text("Продолжить"), button[type="submit"]';

type EmailSignInOptions = {
    waitAfterSubmitMs?: number;
    expectEmailField?: boolean;
};

type PasswordSignInOptions = {
    successUrlPattern?: RegExp;
};

export async function signInWithEmailSeed(
    page: Page,
    email: string,
    options: EmailSignInOptions = {},
): Promise<void> {
    const { waitAfterSubmitMs = 2000, expectEmailField = true } = options;

    await page.goto('/auth/sign-in');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator(EMAIL_INPUT_SELECTOR).first();
    if (expectEmailField) {
        await expect(emailInput).toBeVisible({ timeout: 5000 });
    }

    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await emailInput.fill(email);

        const submitButton = page.locator(EMAIL_SUBMIT_SELECTOR).first();
        if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await submitButton.click();
            await page.waitForTimeout(waitAfterSubmitMs);
        }
    }
}

export async function createStorageStateForEmailSeed(
    browser: Browser,
    email: string,
    options: EmailSignInOptions = {},
): Promise<StorageState> {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await signInWithEmailSeed(page, email, options);
        return await context.storageState();
    } finally {
        await context.close();
    }
}

export async function applyStorageStateCookies(
    page: Page,
    storageState: StorageState | null | undefined,
): Promise<void> {
    if (storageState?.cookies?.length) {
        await page.context().addCookies(storageState.cookies);
    }
}

export async function signInWithPassword(
    page: Page,
    email: string,
    password: string,
    options: PasswordSignInOptions = {},
): Promise<void> {
    const { successUrlPattern = /staff|dashboard/ } = options;

    await page.goto('/auth/sign-in');
    await page.waitForLoadState('networkidle');
    await page.fill(EMAIL_INPUT_SELECTOR, email);
    await page.fill(PASSWORD_INPUT_SELECTOR, password);
    await page.click('button[type="submit"]');
    await page.waitForURL(successUrlPattern, { timeout: 10000 });
}
