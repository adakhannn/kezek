import { isTelegramReminderSnoozed } from '@/app/_components/TelegramReminderBanner';

describe('TelegramReminderBanner snooze', () => {
    const now = 1_800_000_000_000;

    it('stays hidden until the saved reminder time', () => {
        expect(isTelegramReminderSnoozed(String(now + 1_000), now)).toBe(true);
    });

    it('becomes available after the reminder time', () => {
        expect(isTelegramReminderSnoozed(String(now - 1), now)).toBe(false);
        expect(isTelegramReminderSnoozed('invalid', now)).toBe(false);
        expect(isTelegramReminderSnoozed(null, now)).toBe(false);
    });
});
