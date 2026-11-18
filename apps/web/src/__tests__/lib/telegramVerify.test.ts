import crypto from 'crypto';

jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));

import { logWarn } from '@/lib/log';
import type { TelegramAuthData } from '@/lib/telegram/verify';

const BOT_TOKEN = '123456:synthetic-bot-token';

/** verify.ts reads TELEGRAM_BOT_TOKEN at import time. */
function loadVerify(): typeof import('@/lib/telegram/verify') {
    const saved = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    try {
        let module: typeof import('@/lib/telegram/verify') | undefined;
        jest.isolateModules(() => { module = require('@/lib/telegram/verify'); });
        return module!;
    } finally {
        if (saved === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = saved;
    }
}

function signed(data: Omit<TelegramAuthData, 'hash'>): TelegramAuthData {
    const checkString = Object.entries(data).map(([key, value]) => `${key}=${String(value)}`).sort().join('\n');
    const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest();
    return { ...data, hash: crypto.createHmac('sha256', secret).update(checkString).digest('hex') };
}

describe('verifyTelegramAuth logging (ARCH-04)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('a forged hash is rejected and the warning carries neither the expected nor the received hash', () => {
        const { verifyTelegramAuth } = loadVerify();
        const valid = signed({ id: 42, first_name: 'Test', auth_date: Math.floor(Date.now() / 1000) });
        const forged = { ...valid, hash: 'f'.repeat(64) };

        expect(verifyTelegramAuth(forged)).toBe(false);

        expect(logWarn).toHaveBeenCalledTimes(1);
        expect(logWarn).toHaveBeenCalledWith('Telegram', 'Invalid hash');
        const logged = JSON.stringify((logWarn as jest.Mock).mock.calls);
        expect(logged).not.toMatch(/[0-9a-f]{64}/i);
        expect(logged).not.toContain(valid.hash);
    });

    test('a correctly signed payload is accepted without a warning', () => {
        const { verifyTelegramAuth } = loadVerify();
        expect(verifyTelegramAuth(signed({ id: 42, first_name: 'Test', auth_date: Math.floor(Date.now() / 1000) }))).toBe(true);
        expect(logWarn).not.toHaveBeenCalled();
    });
});
