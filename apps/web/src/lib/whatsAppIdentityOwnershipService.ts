import { normalizePhoneToE164 } from '@/lib/senders/sms';
import type { DbQueryClient } from '@/lib/supabaseTypes';

const E164 = /^\+[1-9]\d{7,14}$/;

type AdminLike = DbQueryClient;

/**
 * The account that owns a WhatsApp number, by verified data only (API-03):
 *   1. the profile that linked the number through a WhatsApp OTP (whatsapp_verified);
 *   2. the Auth account whose phone is confirmed (Auth OTP, a WhatsApp sign-in, an admin).
 * An unconfirmed auth.users.phone, user_metadata.phone or profiles.phone is a claim anyone can
 * make about any number; trusting it handed the real owner's next sign-in to that account.
 */
export async function findWhatsAppOwnerByPhone(admin: AdminLike, phone: string): Promise<string | null> {
    const normalizedPhone = normalizePhoneToE164(phone);
    if (!normalizedPhone || !E164.test(normalizedPhone)) return null;

    const { data: linkedProfiles, error: linkedError } = await admin
        .from('profiles')
        .select('id')
        .eq('whatsapp_phone', normalizedPhone)
        .eq('whatsapp_verified', true)
        .limit(1);
    if (linkedError) throw linkedError;
    if (linkedProfiles?.[0]?.id) return linkedProfiles[0].id;

    // GoTrue stores phones as digits without '+'; the function matches both spellings.
    const { data: accounts, error: accountsError } = await admin.rpc('find_accounts_by_contact', {
        p_phone_digits: normalizedPhone.slice(1),
    });
    if (accountsError) throw accountsError;
    return accounts?.[0]?.id ?? null;
}
