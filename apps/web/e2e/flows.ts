import { expect, type Page } from '@playwright/test';

import { createSessionCookies } from './authHelpers';
import { waitForHydration } from './fixtures';
import { getBaseUrl, readRequiredEnv } from './testEnv';

/**
 * Shared steps of the current UI, used by several specs.
 * Dates are business dates: playwright.config.ts sets TZ=Asia/Bishkek, the fixture business zone.
 */

export function businessDate(offsetDays = 0): string {
    const fromEnv = process.env.E2E_TEST_TODAY;
    const base = fromEnv && /^\d{4}-\d{2}-\d{2}$/.test(fromEnv) ? new Date(`${fromEnv}T12:00:00`) : new Date();
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays, 12);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

/** Next step of the public booking wizard (/b/[slug]/booking). */
export async function bookingNext(page: Page): Promise<void> {
    const next = page.getByRole('button', { name: /^Далее/ });
    await expect(next).toBeEnabled({ timeout: 10_000 });
    await next.click();
}

/** Picks a day in the booking calendar, switching to the next month when needed. */
export async function pickCalendarDay(page: Page, ymd: string): Promise<void> {
    const calendar = page.getByTestId('date-picker');
    await expect(calendar).toBeVisible({ timeout: 10_000 });
    const day = calendar.locator(`button[data-date="${ymd}"]:not([disabled])`);
    if (!(await day.count())) {
        await calendar.getByRole('button', { name: 'Следующий месяц' }).click();
    }
    await day.click();
    await expect(day).toHaveAttribute('aria-pressed', 'true');
}

type BookingWalk = {
    slug: string;
    day: string;
    /** Services of the master to add to the visit, by Russian name. */
    services?: string[];
};

/**
 * Walks branch → day → master → services → time of the public booking flow and returns the
 * first free time slot (not clicked).
 */
export async function walkPublicBookingToSlots(page: Page, { slug, day, services = ['Стрижка'] }: BookingWalk) {
    await page.goto(`/b/${slug}/booking`);

    const branch = page.getByTestId('branch-card').filter({ hasText: 'E2E Филиал Центр' });
    await expect(branch).toBeVisible({ timeout: 15_000 });
    // The first click can land before hydration under `next dev`; repeat until it is selected.
    await expect(async () => {
        if ((await branch.getAttribute('aria-pressed')) !== 'true') await branch.click();
        await expect(branch).toHaveAttribute('aria-pressed', 'true', { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await bookingNext(page);

    await pickCalendarDay(page, day);
    await bookingNext(page);

    const master = page.getByTestId('master-card').filter({ hasText: 'E2E Мастер' });
    await expect(master).toBeVisible({ timeout: 30_000 });
    await master.click();
    await bookingNext(page);

    for (const name of services) {
        const card = page.getByTestId('service-card').filter({ hasText: name });
        await expect(card).toBeVisible({ timeout: 10_000 });
        await card.click();
        await expect(card).toHaveAttribute('aria-pressed', 'true');
    }
    await bookingNext(page);

    const slot = page.getByTestId('time-slot').first();
    await expect(slot).toBeVisible({ timeout: 30_000 });
    return slot;
}

/** Guest path after a slot click: "without registration", name and phone, book. */
export async function completeGuestBooking(page: Page, name: string, phone: string): Promise<void> {
    await page.getByRole('dialog').getByRole('button', { name: /Запись без регистрации/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Ваше имя/).fill(name);
    await dialog.getByLabel(/^Телефон/).fill(phone);
    await dialog.getByRole('button', { name: 'Забронировать', exact: true }).click();
}

/** The booking receipt page the flows redirect to. */
export async function expectBookingReceipt(page: Page): Promise<string> {
    await page.waitForURL(/\/booking\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const id = /\/booking\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
    return id;
}

/** Opens a tab of the dashboard bookings workspace (Календарь / Список / QuickDesk). */
export async function openBookingsTab(
    page: Page,
    tab: 'Календарь (сегодня)' | 'История и поиск' | 'Сегодня (QuickDesk)',
): Promise<void> {
    await page.goto('/dashboard/bookings');
    const button = page.getByRole('tab', { name: tab, exact: true });
    await expect(button).toBeVisible({ timeout: 30_000 });
    // Clicks before hydration under `next dev` are lost; repeat until the tab is selected.
    await expect(async () => {
        await button.click();
        await expect(button).toHaveAttribute('aria-selected', 'true', { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
}

/** Reopens today's closed shift of E2E_TEST_STAFF_ID as the manager (staff cannot reopen their own). */
async function reopenShiftAsManager(page: Page): Promise<void> {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser to open the manager context');
    const context = await browser.newContext({ baseURL: getBaseUrl() });
    try {
        await context.addCookies(await createSessionCookies(readRequiredEnv('E2E_TEST_MANAGER_EMAIL')));
        const manager = await context.newPage();
        await manager.goto(`/dashboard/staff/${readRequiredEnv('E2E_TEST_STAFF_ID')}/finance`);
        await waitForHydration(manager);
        await ensureShiftOpen(manager);
    } finally {
        await context.close();
    }
}

/**
 * Staff finance workspace (/staff/finance or the manager's copy): makes today's shift open.
 * Earlier specs may have closed it; the manager's page offers "reopen", the staff page does not.
 */
export async function ensureShiftOpen(page: Page): Promise<void> {
    const open = page.getByRole('button', { name: 'Открыть смену' });
    const reopen = page.getByRole('button', { name: /^Переоткрыть/ });
    const close = page.getByRole('button', { name: 'Закрыть смену' });
    const closed = page.getByText('Закрыта', { exact: true });
    const settle = async () => {
        await expect(async () => {
            // A slow first load under `next dev` can hit the page's 8 s finance timeout; retry it.
            const retry = page.getByRole('button', { name: 'Попробовать снова' });
            if (await retry.isVisible()) await retry.click();
            await page.getByRole('button', { name: /^Текущая смена/ }).first().click();
            await expect(page.getByText('Ошибка загрузки данных')).toHaveCount(0, { timeout: 2_000 });
            await expect(open.or(reopen).or(close).or(closed).first()).toBeVisible({ timeout: 3_000 });
        }).toPass({ timeout: 45_000 });
    };
    await settle();
    if (await open.isVisible()) await open.click();
    else if (await reopen.isVisible()) await reopen.click();
    else if (!(await close.isVisible())) {
        await reopenShiftAsManager(page);
        await page.reload();
        await settle();
    }
    await expect(close).toBeVisible({ timeout: 20_000 });
}

/** Adds a walk-in client to the open shift and saves it. */
export async function addShiftClient(
    page: Page,
    { name, service, amount }: { name: string; service: string; amount: number },
): Promise<void> {
    const form = page
        .locator('div')
        .filter({ has: page.getByRole('heading', { name: 'Редактирование клиента' }) })
        .filter({ has: page.getByPlaceholder('Введите имя клиента') })
        .last();
    // Under `next dev` a click can land before the tab or the button is interactive and open nothing:
    // repeat the two clicks until the form is there.
    await expect(async () => {
        await page.getByRole('button', { name: /^Клиенты/ }).first().click();
        if (!(await form.getByPlaceholder('Введите имя клиента').isVisible())) {
            await page.getByRole('button', { name: 'Добавить клиента' }).first().click();
        }
        await expect(form.getByPlaceholder('Введите имя клиента')).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await form.getByPlaceholder('Введите имя клиента').fill(name);
    await form.getByRole('checkbox', { name: service, exact: true }).check();
    await form.locator('input[type="number"]').first().fill(String(amount));
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

/** Manager stats of one staff member for one business day; returns that day's shift card. */
export async function openStaffShiftOfDay(page: Page, staffId: string, ymd: string) {
    await page.goto(`/dashboard/staff/${staffId}/finance/stats`);
    const dayButton = page.getByRole('button', { name: 'День', exact: true });
    await expect(dayButton).toBeEnabled({ timeout: 20_000 });
    await dayButton.click();
    const dateInput = page.getByLabel('Дата периода');
    if ((await dateInput.inputValue()) !== ymd) {
        const statsResponse = page.waitForResponse(
            (response) => response.url().includes(`/api/dashboard/staff/${staffId}/finance/stats`) && response.url().includes(ymd),
        );
        await dateInput.fill(ymd);
        expect((await statsResponse).status()).toBe(200);
    }
    const label = ymd.split('-').reverse().join('.');
    // The card is the innermost block holding the header button that starts with the shift date.
    const header = page.getByRole('button', { name: new RegExp(`^${label.replace(/\./g, '\\.')}`) });
    const card = page.locator('div').filter({ has: header }).last();
    await expect(card).toBeVisible();
    return card;
}

/** An amount of the shift summary ("Итого сотруднику за смену", …) as a number. */
export async function shiftSummaryAmount(page: Page, label: string): Promise<number> {
    const value = page.getByText(label, { exact: true }).locator('xpath=following-sibling::div[1]');
    await expect(value).toBeVisible();
    const text = (await value.textContent()) ?? '';
    return Number(text.replace(/[^\d,.-]/g, '').replace(',', '.'));
}
