// apps/web/src/lib/telegram/verify.ts
import crypto from 'crypto';

import { logError, logWarn } from '../log';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export type TelegramAuthData = {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
};

/**
 * Проверяет подпись данных от Telegram Login Widget.
 * Документация: https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(data: TelegramAuthData): boolean {
    if (!TELEGRAM_BOT_TOKEN) {
        logError('Telegram', 'TELEGRAM_BOT_TOKEN not configured');
        return false;
    }

    // 1) Проверяем, что данные не слишком старые (24 часа)
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec - data.auth_date > 86400) {
        logWarn('Telegram', 'Auth data expired');
        return false;
    }

    // 2) Собираем check_string
    const entries: [string, string][] = Object.entries(data)
        .filter(([key]) => key !== 'hash')
        .map(([key, value]) => [key, String(value)]);

    const checkString = entries
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    // 3) Считаем HMAC-SHA256(check_string, secret_key)
    const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    if (hmac !== data.hash) {
        logWarn('Telegram', 'Invalid hash', { expected: hmac, actual: data.hash });
        return false;
    }

    return true;
}

/**
 * Приводим данные Telegram к удобному виду для хранения в profiles.
 */
export function normalizeTelegramData(data: TelegramAuthData): {
    telegram_id: number;
    full_name: string | null;
    telegram_username: string | null;
    telegram_photo_url: string | null;
} {
    const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || null;

    return {
        telegram_id: data.id,
        full_name: fullName,
        telegram_username: data.username || null,
        telegram_photo_url: data.photo_url || null,
    };
}


