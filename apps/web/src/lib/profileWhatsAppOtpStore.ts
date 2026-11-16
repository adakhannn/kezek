import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side storage for the profile "link WhatsApp" OTP.
 *
 * The record lives in Auth `app_metadata`, which only the service role can
 * write. Only an HMAC of the code is stored (see whatsAppOtpHash), never the
 * code itself, so reading one's own session does not reveal it.
 */
export const PROFILE_WHATSAPP_OTP_METADATA_KEY = 'whatsapp_link_otp';
export const MAX_PROFILE_WHATSAPP_OTP_ATTEMPTS = 5;
export const PROFILE_WHATSAPP_OTP_TTL_MS = 10 * 60 * 1000;

export type ProfileWhatsAppOtpRecord = {
    codeHash: string;
    phone: string;
    expiresAt: string;
    attempts: number;
};

export type ProfileWhatsAppOtpStore = {
    save: (userId: string, record: ProfileWhatsAppOtpRecord) => Promise<void>;
    load: (userId: string) => Promise<ProfileWhatsAppOtpRecord | null>;
    clear: (userId: string) => Promise<void>;
};

function parseRecord(value: unknown): ProfileWhatsAppOtpRecord | null {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    if (
        typeof raw.codeHash !== 'string' ||
        typeof raw.phone !== 'string' ||
        typeof raw.expiresAt !== 'string' ||
        typeof raw.attempts !== 'number'
    ) {
        return null;
    }
    return {
        codeHash: raw.codeHash,
        phone: raw.phone,
        expiresAt: raw.expiresAt,
        attempts: raw.attempts,
    };
}

/** Auth admin metadata updates merge top-level keys; `null` removes a key. */
export function createProfileWhatsAppOtpStore(admin: SupabaseClient): ProfileWhatsAppOtpStore {
    return {
        async save(userId, record) {
            const { error } = await admin.auth.admin.updateUserById(userId, {
                app_metadata: { [PROFILE_WHATSAPP_OTP_METADATA_KEY]: record },
            });
            if (error) throw new Error('Profile WhatsApp OTP save failed');
        },
        async load(userId) {
            const { data, error } = await admin.auth.admin.getUserById(userId);
            if (error || data.user?.id !== userId) throw new Error('Profile WhatsApp OTP load failed');
            const appMetadata = (data.user.app_metadata ?? {}) as Record<string, unknown>;
            return parseRecord(appMetadata[PROFILE_WHATSAPP_OTP_METADATA_KEY]);
        },
        async clear(userId) {
            const { error } = await admin.auth.admin.updateUserById(userId, {
                app_metadata: { [PROFILE_WHATSAPP_OTP_METADATA_KEY]: null },
            });
            if (error) throw new Error('Profile WhatsApp OTP clear failed');
        },
    };
}
