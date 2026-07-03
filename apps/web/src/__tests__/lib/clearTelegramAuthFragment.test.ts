import { isTelegramAuthFragment } from '@/lib/clearTelegramAuthFragment';

describe('isTelegramAuthFragment', () => {
    test('recognizes Telegram widget callback fragments', () => {
        expect(isTelegramAuthFragment('#tgAuthResult=signed-payload')).toBe(true);
    });

    test('does not clear unrelated fragments', () => {
        expect(isTelegramAuthFragment('#profile')).toBe(false);
        expect(isTelegramAuthFragment('')).toBe(false);
    });
});
