/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { NameReminderBanner } from '@/app/_components/NameReminderBanner';

let mockPathname = '/catalog';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
// The server decides whether the reminder is due (ReminderBanners); the banner never queries the
// profile and opens no realtime channel. Any use of the browser client fails the test.
jest.mock('@/lib/supabaseClient', () => ({
    get supabase() { throw new Error('NameReminderBanner must not use the Supabase client'); },
}));

beforeEach(() => { mockPathname = '/catalog'; });

test.each(['/cabinet', '/cabinet/profile'])('stays hidden inside the cabinet (%s), where the name is filled in', (path) => {
    mockPathname = path;
    render(<NameReminderBanner />);
    expect(screen.queryByText('Заполнить профиль')).toBeNull();
});

test('shows on other pages, hides when dismissed and shows again on the next page', () => {
    const { rerender } = render(<NameReminderBanner />);
    expect(screen.getByRole('link', { name: 'Заполнить профиль' }).getAttribute('href')).toBe('/cabinet');

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByText('Заполнить профиль')).toBeNull();

    mockPathname = '/catalog/another';
    rerender(<NameReminderBanner />);
    expect(screen.getByText('Заполнить профиль')).toBeTruthy();

    mockPathname = '/cabinet/profile';
    rerender(<NameReminderBanner />);
    expect(screen.queryByText('Заполнить профиль')).toBeNull();
});
