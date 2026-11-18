/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { TelegramReminderBanner } from '@/app/_components/TelegramReminderBanner';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
// The server decides whether the reminder is due (ReminderBanners); the banner never queries.
jest.mock('@/lib/supabaseClient', () => ({
    get supabase() { throw new Error('TelegramReminderBanner must not use the Supabase client'); },
}));

const KEY = 'kezek:telegram-reminder:snoozed-until:user-1';

beforeEach(() => {
    window.localStorage.clear();
    mockPush.mockClear();
});

test('shows the reminder for an account that has not snoozed it and links to the Telegram section', () => {
    render(<TelegramReminderBanner userId="user-1" />);
    expect(screen.getByText('Не пропускайте изменения записи')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Подключить Telegram' }));
    expect(mockPush).toHaveBeenCalledWith('/cabinet/profile#telegram-connection');
});

test('"remind later" hides it and snoozes it for this account only', () => {
    const before = Date.now();
    const { unmount } = render(<TelegramReminderBanner userId="user-1" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Напомнить позже' })[0]);
    expect(screen.queryByText('Не пропускайте изменения записи')).toBeNull();
    expect(Number(window.localStorage.getItem(KEY))).toBeGreaterThan(before + 6 * 24 * 60 * 60 * 1000);
    unmount();

    render(<TelegramReminderBanner userId="user-1" />);
    expect(screen.queryByText('Не пропускайте изменения записи')).toBeNull();
    render(<TelegramReminderBanner userId="user-2" />);
    expect(screen.getByText('Не пропускайте изменения записи')).toBeTruthy();
});

test('an expired snooze shows the reminder again', () => {
    window.localStorage.setItem(KEY, String(Date.now() - 1));
    render(<TelegramReminderBanner userId="user-1" />);
    expect(screen.getByText('Не пропускайте изменения записи')).toBeTruthy();
});
