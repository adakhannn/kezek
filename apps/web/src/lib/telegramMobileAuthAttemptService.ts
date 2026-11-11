import crypto from 'crypto';

import { MOBILE_CODE_CHALLENGE_RE } from '@/lib/mobileExchangeService';
import { getServiceClient } from '@/lib/supabaseService';
import { formatTelegramMobileStartPayload } from '@/lib/telegramMobileDeepLinkPayload';
import { trackTelegramMobileMetric } from '@/lib/telegramMobileMetricsService';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export type TelegramMobileAuthAttemptStatus =
    | 'pending'
    | 'consumed'
    | 'approved'
    | 'failed'
    | 'expired';

export type TelegramMobileAuthSourceMeta = {
    appName?: string | null;
    device?: string | null;
    region?: string | null;
    platform?: string | null;
    userAgent?: string | null;
};

export type TelegramMobileAuthAttempt = {
    nonce: string;
    codeChallenge?: string;
    status: TelegramMobileAuthAttemptStatus;
    createdAt: number;
    expiresAt: number;
    telegramId?: number;
    userId?: string;
    linkage?: 'existing' | 'created';
    exchangeCode?: string;
    consumedAt?: number;
    failureReason?: string;
    source?: TelegramMobileAuthSourceMeta;
    expectedTelegramId?: number;
    telegramChatId?: number;
    telegramUsername?: string;
    telegramFirstName?: string;
    telegramLastName?: string;
};

type AttemptRow = {
    source: TelegramMobileAuthSourceMeta | null;
    telegram_context: { chatId?: number; username?: string; firstName?: string; lastName?: string } | null;
    linkage: 'existing' | 'created' | null;
    nonce: string;
    code_challenge: string | null;
    status: string;
    telegram_id: number | null;
    user_id: string | null;
    exchange_code: string | null;
    expires_at: string;
    consumed_at: string | null;
    created_at: string;
};

function getAttemptsAdmin() {
    return getServiceClient();
}

function nowMs() {
    return Date.now();
}

function nowIso() {
    return new Date(nowMs()).toISOString();
}

function toAttempt(row: AttemptRow): TelegramMobileAuthAttempt {
    return {
        source: row.source ?? undefined,
        linkage: row.linkage ?? undefined,
        telegramChatId: row.telegram_context?.chatId,
        telegramUsername: row.telegram_context?.username,
        telegramFirstName: row.telegram_context?.firstName,
        telegramLastName: row.telegram_context?.lastName,
        nonce: row.nonce,
        codeChallenge: row.code_challenge ?? undefined,
        status: row.status as TelegramMobileAuthAttemptStatus,
        createdAt: Date.parse(row.created_at),
        expiresAt: Date.parse(row.expires_at),
        telegramId: row.telegram_id ?? undefined,
        expectedTelegramId: row.telegram_id ?? undefined,
        userId: row.user_id ?? undefined,
        exchangeCode: row.exchange_code ?? undefined,
        consumedAt: row.consumed_at ? Date.parse(row.consumed_at) : undefined,
    };
}

function generateNonce() {
    return crypto.randomBytes(24).toString('base64url');
}

function buildBotDeepLink(botUsername: string, nonce: string) {
    const startPayload = formatTelegramMobileStartPayload(nonce);
    return `https://t.me/${botUsername}?start=${startPayload}`;
}

async function getAttemptRow(nonce: string): Promise<AttemptRow | null> {
    const admin = getAttemptsAdmin();
    const { data, error } = await admin
        .from('telegram_mobile_auth_attempts')
        .select('source,telegram_context,linkage,nonce,code_challenge,status,telegram_id,user_id,exchange_code,expires_at,consumed_at,created_at')
        .eq('nonce', nonce)
        .single();

    if (error) {
        return null;
    }

    return data;
}

async function markExpiredIfNeeded(row: AttemptRow): Promise<AttemptRow> {
    if (row.status !== 'pending') {
        return row;
    }

    if (Date.parse(row.expires_at) > nowMs()) {
        return row;
    }

    const admin = getAttemptsAdmin();
    const { data } = await admin
        .from('telegram_mobile_auth_attempts')
        .update({ status: 'expired' })
        .eq('nonce', row.nonce)
        .select('source,telegram_context,linkage,nonce,code_challenge,status,telegram_id,user_id,exchange_code,expires_at,consumed_at,created_at')
        .maybeSingle();

    if (data) {
        void trackTelegramMobileMetric('telegram_mobile_login_expired', {
            nonce: row.nonce,
            telegramId: row.telegram_id ?? null,
            metadata: {
                reason: 'ttl_read_attempt',
            },
        });
        return data;
    }

    return row;
}

export async function createTelegramMobileAuthAttempt({
    botUsername,
    codeChallenge,
    ttlMs = DEFAULT_TTL_MS,
    source,
}: {
    botUsername: string;
    codeChallenge: string;
    ttlMs?: number;
    source?: TelegramMobileAuthSourceMeta;
}) {
    if (!MOBILE_CODE_CHALLENGE_RE.test(codeChallenge)) throw new Error('Invalid mobile sign-in binding');
    const now = nowMs();
    const expiresAt = now + ttlMs;
    const admin = getAttemptsAdmin();

    let nonce = generateNonce();
    let inserted = false;

    for (let i = 0; i < 5 && !inserted; i += 1) {
        const { error } = await admin.from('telegram_mobile_auth_attempts').insert({
            nonce,
            code_challenge: codeChallenge,
            source: source ?? null,
            status: 'pending',
            expires_at: new Date(expiresAt).toISOString(),
        });

        if (!error) {
            inserted = true;
            break;
        }

        nonce = generateNonce();
    }

    if (!inserted) {
        throw new Error('Не удалось создать попытку входа через Telegram');
    }

    void trackTelegramMobileMetric('telegram_mobile_login_started', {
        nonce,
        metadata: {
            appName: source?.appName ?? null,
            platform: source?.platform ?? null,
        },
    });

    return {
        nonce,
        botDeepLink: buildBotDeepLink(botUsername, nonce),
        expiresAt,
    };
}

export async function getTelegramMobileAuthAttempt(nonce: string) {
    const row = await getAttemptRow(nonce);
    if (!row) {
        return null;
    }

    const effective = await markExpiredIfNeeded(row);
    return toAttempt(effective);
}

export async function getTelegramMobileAuthStatus(nonce: string): Promise<{
    status: TelegramMobileAuthAttemptStatus;
    expiresAt: number | null;
    exchangeCode?: string;
}> {
    const row = await getAttemptRow(nonce);
    if (!row) {
        return {
            status: 'failed',
            expiresAt: null,
        };
    }

    const effective = await markExpiredIfNeeded(row);
    const status =
        effective.status === 'consumed'
            ? 'pending'
            : (effective.status as TelegramMobileAuthAttemptStatus);

    return {
        status,
        expiresAt: Date.parse(effective.expires_at),
        exchangeCode: effective.exchange_code ?? undefined,
    };
}

export async function consumePendingTelegramMobileAuthAttempt(nonce: string): Promise<{
    ok: true;
    attempt: TelegramMobileAuthAttempt;
} | {
    ok: false;
    error: 'not_found' | 'expired' | 'invalid_status';
}> {
    const admin = getAttemptsAdmin();
    const consumedAtIso = nowIso();
    const nowIsoValue = nowIso();

    const { data: consumed, error } = await admin
        .from('telegram_mobile_auth_attempts')
        .update({
            status: 'consumed',
            consumed_at: consumedAtIso,
        })
        .eq('nonce', nonce)
        .eq('status', 'pending')
        .is('consumed_at', null)
        .gt('expires_at', nowIsoValue)
        .select('source,telegram_context,linkage,nonce,code_challenge,status,telegram_id,user_id,exchange_code,expires_at,consumed_at,created_at')
        .maybeSingle();

    if (error) {
        return { ok: false, error: 'invalid_status' };
    }

    if (consumed) {
        return { ok: true, attempt: toAttempt(consumed) };
    }

    const current = await getAttemptRow(nonce);
    if (!current) {
        return { ok: false, error: 'not_found' };
    }

    if (Date.parse(current.expires_at) <= nowMs()) {
        await admin
            .from('telegram_mobile_auth_attempts')
            .update({ status: 'expired' })
            .eq('nonce', nonce);
        void trackTelegramMobileMetric('telegram_mobile_login_expired', {
            nonce,
            telegramId: current.telegram_id ?? null,
            metadata: {
                reason: 'ttl_consume',
            },
        });
        return { ok: false, error: 'expired' };
    }

    return { ok: false, error: 'invalid_status' };
}

export async function markTelegramMobileAuthAttemptApproved({
    nonce,
    telegramId,
    userId,
    exchangeCode,
    linkage,
}: {
    nonce: string;
    telegramId: number;
    userId: string;
    exchangeCode: string;
    linkage: 'existing' | 'created';
}) {
    const admin = getAttemptsAdmin();
    await admin
        .from('telegram_mobile_auth_attempts')
        .update({
            status: 'approved',
            linkage,
            telegram_id: telegramId,
            user_id: userId,
            exchange_code: exchangeCode,
        })
        .eq('nonce', nonce);

    void trackTelegramMobileMetric('telegram_mobile_login_approved', {
        nonce,
        telegramId,
        metadata: {
            linkage,
        },
    });
}

export async function markTelegramMobileAuthAttemptFailed({
    nonce,
    reason,
}: {
    nonce: string;
    reason: string;
}) {
    const admin = getAttemptsAdmin();
    const current = await getAttemptRow(nonce);
    await admin
        .from('telegram_mobile_auth_attempts')
        .update({
            status: 'failed',
        })
        .eq('nonce', nonce);

    void trackTelegramMobileMetric('telegram_mobile_login_failed', {
        nonce,
        telegramId: current?.telegram_id ?? null,
        metadata: {
            reason,
        },
    });
}

export async function attachTelegramMobileAuthAttemptTelegramContext({
    nonce,
    telegramId,
    chatId,
    username,
    firstName,
    lastName,
}: {
    nonce: string;
    telegramId: number;
    chatId: number;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
}): Promise<{
    ok: true;
    attempt: TelegramMobileAuthAttempt;
} | {
    ok: false;
    error: 'not_found' | 'expired' | 'invalid_status' | 'already_bound_other_telegram';
}> {
    const row = await getAttemptRow(nonce);
    if (!row) {
        return { ok: false, error: 'not_found' };
    }

    const effective = await markExpiredIfNeeded(row);
    if (effective.status === 'expired') {
        return { ok: false, error: 'expired' };
    }

    if (effective.status !== 'pending') {
        return { ok: false, error: 'invalid_status' };
    }

    if (effective.telegram_id && effective.telegram_id !== telegramId) {
        return { ok: false, error: 'already_bound_other_telegram' };
    }

    const admin = getAttemptsAdmin();
    let binding = admin.from('telegram_mobile_auth_attempts')
        .update({ telegram_id: telegramId, telegram_context: { chatId, username, firstName, lastName } })
        .eq('nonce', nonce).eq('status', 'pending').gt('expires_at', nowIso());
    binding = effective.telegram_id == null
        ? binding.is('telegram_id', null)
        : binding.eq('telegram_id', telegramId);
    const { data: updated, error } = await binding
        .select('source,telegram_context,linkage,nonce,code_challenge,status,telegram_id,user_id,exchange_code,expires_at,consumed_at,created_at')
        .maybeSingle();
    if (error || !updated) return { ok: false, error: 'invalid_status' };
    return { ok: true, attempt: toAttempt(updated) };
}

export async function __resetTelegramMobileAuthAttemptsForTests() {
    const admin = getAttemptsAdmin();
    await admin.from('telegram_mobile_auth_attempts').delete().lt('created_at', '9999-12-31T23:59:59.999Z');
}

export async function __setTelegramMobileAuthAttemptStatusForTests(
    nonce: string,
    status: TelegramMobileAuthAttemptStatus,
    options?: {
        exchangeCode?: string;
        telegramId?: number;
        userId?: string;
        linkage?: 'existing' | 'created';
    },
) {
    const admin = getAttemptsAdmin();
    await admin
        .from('telegram_mobile_auth_attempts')
        .update({
            status,
            exchange_code: options?.exchangeCode,
            telegram_id: options?.telegramId,
            user_id: options?.userId,
        })
        .eq('nonce', nonce);
}
