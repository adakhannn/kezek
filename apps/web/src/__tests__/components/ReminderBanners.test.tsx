jest.mock('server-only', () => ({}), { virtual: true });

const mockGetShellViewer = jest.fn();
jest.mock('@/lib/shellViewer', () => ({ getShellViewer: () => mockGetShellViewer() }));

import { NameReminderBanner } from '@/app/_components/NameReminderBanner';
import { ReminderBanners } from '@/app/_components/ReminderBanners';
import { TelegramReminderBanner } from '@/app/_components/TelegramReminderBanner';

const signedIn = (reminder: 'name' | 'telegram' | null) => ({
    status: 'signed-in',
    userId: 'user-1',
    accountLabel: 'Name',
    roles: { hasDashboard: false, hasStaff: false, hasCabinet: true, hasAdmin: false },
    reminder,
});

test('renders the reminder the server viewer asks for, and nothing otherwise', async () => {
    mockGetShellViewer.mockResolvedValueOnce(signedIn('name'));
    expect((await ReminderBanners())?.type).toBe(NameReminderBanner);

    mockGetShellViewer.mockResolvedValueOnce(signedIn('telegram'));
    const telegram = await ReminderBanners();
    expect(telegram?.type).toBe(TelegramReminderBanner);
    expect(telegram?.props).toEqual({ userId: 'user-1' });

    mockGetShellViewer.mockResolvedValueOnce(signedIn(null));
    expect(await ReminderBanners()).toBeNull();
    mockGetShellViewer.mockResolvedValueOnce({ status: 'anonymous' });
    expect(await ReminderBanners()).toBeNull();
    mockGetShellViewer.mockResolvedValueOnce({ status: 'unavailable' });
    expect(await ReminderBanners()).toBeNull();
});
