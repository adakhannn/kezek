import { getServiceClient } from '@/lib/supabaseService';

type UsersSearchInput = {
    q?: string;
    page: number;
    perPage: number;
};

type UsersSearchContext = {
    supabase: any;
    bizId: string;
    input: UsersSearchInput;
};

type AccountRow = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
};

export type UsersSearchItem = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s()-]+$/;
const MIN_PHONE_DIGITS = 9;
const MAX_PHONE_DIGITS = 15;
const MIN_PARTIAL_LENGTH = 2;
// Most recent bookings scanned for the business's clients; enough for a QuickDesk lookup.
const CLIENT_SCAN_LIMIT = 2000;
const ID_CHUNK = 200;

function phoneDigits(query: string): string | null {
    if (!PHONE_RE.test(query)) return null;
    let digits = query.replace(/\D/g, '');
    // Local Kyrgyz format 0XXX XXX XXX.
    if (digits.length === 10 && digits.startsWith('0')) digits = `996${digits.slice(1)}`;
    if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) return null;
    return digits;
}

function chunks<T>(values: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
    return result;
}

// A complete e-mail or phone: the accounts with that confirmed contact.
async function findExactContact(admin: any, query: string): Promise<AccountRow[] | null> {
    const email = EMAIL_RE.test(query) ? query : null;
    const phone = email ? null : phoneDigits(query);
    if (!email && !phone) return null;
    const { data, error } = await admin.rpc('find_accounts_by_contact', { p_email: email, p_phone_digits: phone });
    if (error) throw new Error('User lookup unavailable');
    return (data ?? []) as AccountRow[];
}

// Any other text: only people who already booked with this business.
async function findBusinessClients(admin: any, bizId: string, query: string): Promise<AccountRow[]> {
    const { data: bookingRows, error: bookingsError } = await admin
        .from('bookings')
        .select('client_id')
        .eq('biz_id', bizId)
        .not('client_id', 'is', null)
        .order('start_at', { ascending: false })
        .limit(CLIENT_SCAN_LIMIT);
    if (bookingsError) throw new Error('Business clients unavailable');

    const clientIds = [...new Set(
        ((bookingRows ?? []) as { client_id?: unknown }[])
            .map((row) => row.client_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
    )];
    if (clientIds.length === 0) return [];

    const accounts: AccountRow[] = [];
    for (const ids of chunks(clientIds, ID_CHUNK)) {
        const { data, error } = await admin.from('auth_users_view').select('id,email,phone,full_name').in('id', ids);
        if (error) throw new Error('Business clients unavailable');
        accounts.push(...((data ?? []) as AccountRow[]));
    }

    const needle = query.toLowerCase();
    const needleDigits = query.replace(/\D/g, '');
    return accounts.filter((account) =>
        (account.email ?? '').toLowerCase().includes(needle)
        || (account.full_name ?? '').toLowerCase().includes(needle)
        || (needleDigits.length >= 3 && (account.phone ?? '').replace(/\D/g, '').includes(needleDigits)));
}

/**
 * Account lookup for managers (QuickDesk client, new staff from an account, branch admins).
 * It must not work as a directory of the platform's accounts:
 *   * a complete e-mail address or phone number finds the account with that confirmed contact;
 *   * any other text (two or more characters) is searched only among the business's own clients.
 * Staff of the business are left out, as before.
 */
export async function runUsersSearch({ supabase, bizId, input }: UsersSearchContext) {
    const query = (input.q ?? '').trim().slice(0, 100);
    const pageNum = Math.max(1, Math.min(100, input.page));
    const perPageNum = Math.max(1, Math.min(100, input.perPage));
    const empty = { items: [] as UsersSearchItem[], page: pageNum, perPage: perPageNum };

    // A missing search term must never become a platform account directory.
    // Keep this guard below HTTP validation too, for direct service consumers.
    if (!query) return empty;

    const admin = getServiceClient();
    let accounts = await findExactContact(admin, query);
    if (!accounts) {
        if (query.length < MIN_PARTIAL_LENGTH) return empty;
        accounts = await findBusinessClients(admin, bizId, query);
    }
    if (accounts.length === 0) return empty;

    const [staffResult, profileResult] = await Promise.all([
        supabase.from('staff').select('user_id').eq('biz_id', bizId).not('user_id', 'is', null),
        admin.from('profiles').select('id,full_name').in('id', accounts.slice(0, ID_CHUNK).map((account) => account.id)),
    ]);
    if (profileResult.error) throw new Error('Client profile names unavailable');

    // The edited profile name is canonical; the Auth metadata name is only a fallback.
    const profileNames = new Map<string, string>(((profileResult.data ?? []) as { id: string; full_name: unknown }[])
        .map((profile) => [profile.id, typeof profile.full_name === 'string' ? profile.full_name.trim() : '']));
    const existingStaffUserIds = new Set(
        ((staffResult.data ?? []) as { user_id?: unknown }[])
            .map((staff) => staff.user_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );

    const items: UsersSearchItem[] = accounts
        .filter((account) => !existingStaffUserIds.has(account.id))
        .map((account) => ({
            id: account.id,
            email: account.email ?? null,
            phone: account.phone ?? null,
            full_name: profileNames.get(account.id) || account.full_name?.trim() || account.email || 'Без имени',
        }));

    const start = (pageNum - 1) * perPageNum;
    return {
        items: items.slice(start, start + perPageNum),
        page: pageNum,
        perPage: perPageNum,
    };
}
