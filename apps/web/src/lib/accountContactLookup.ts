import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Phone digits as auth.users.phone stores them (996555123456). A local Kyrgyz number written
 * as 0555 123 456 becomes 996555123456. null for anything that cannot be a phone number.
 */
export function contactPhoneDigits(phone: string | null | undefined): string | null {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('0')) digits = `996${digits.slice(1)}`;
    if (digits.length < 8 || digits.length > 15) return null;
    return digits;
}

/**
 * The one account that has confirmed this e-mail or phone, found by public.find_accounts_by_contact
 * (exact e-mail ignoring case, phone with or without '+', confirmed contacts only, service role).
 * null when nothing matches or when the e-mail and the phone belong to different accounts:
 * linking an account must never guess (ARCH-03). Paging through Auth users (listUsers) saw only
 * the newest users and trusted unconfirmed and user-editable contacts.
 */
export async function findAccountIdByConfirmedContact(
    admin: Pick<SupabaseClient, 'rpc'>,
    contact: { email?: string | null; phone?: string | null },
): Promise<string | null> {
    const email = contact.email?.trim() || null;
    const digits = contactPhoneDigits(contact.phone);
    if (!email && !digits) return null;

    const { data, error } = await admin.rpc('find_accounts_by_contact', {
        ...(email ? { p_email: email } : {}),
        ...(digits ? { p_phone_digits: digits } : {}),
    });
    if (error) throw error;

    const ids = new Set(((Array.isArray(data) ? data : []) as Array<{ id?: string | null }>).map((row) => row.id).filter(Boolean));
    return ids.size === 1 ? [...ids][0] ?? null : null;
}
