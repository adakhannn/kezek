import { normalizePhoneToE164 } from '@/lib/senders/sms';

type AuthUser = {
    id: string;
    phone?: string | null;
    user_metadata?: Record<string, unknown> | null;
};

type AdminLike = {
    auth: {
        admin: {
            listUsers: (params: { page: number; perPage: number }) => Promise<{
                data?: { users?: AuthUser[] } | null;
                error?: { message?: string } | null;
            }>;
        };
    };
    // PostgREST builders vary between the two ownership lookups.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

function normalizedMetadataPhone(user: AuthUser) {
    const metadataPhone = user.user_metadata?.phone;
    return normalizePhoneToE164(typeof metadataPhone === 'string' ? metadataPhone : null);
}

export async function findWhatsAppOwnerByPhone(admin: AdminLike, phone: string): Promise<string | null> {
    const normalizedPhone = normalizePhoneToE164(phone);
    if (!normalizedPhone) return null;

    // A verified profile link is the canonical Kezek identity. Check it before
    // auth.users so a stale or accidentally-created phone-only auth user cannot
    // take ownership away from an account that explicitly linked the number.
    const { data: modernProfiles, error: modernError } = await admin
        .from('profiles')
        .select('id')
        .eq('whatsapp_phone', normalizedPhone)
        .eq('whatsapp_verified', true)
        .limit(1);
    if (modernError) throw modernError;
    if (modernProfiles?.[0]?.id) return modernProfiles[0].id;

    const perPage = 1000;
    for (let page = 1; page <= 100; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const users = data?.users ?? [];
        const owner = users.find((candidate) =>
            normalizePhoneToE164(candidate.phone) === normalizedPhone || normalizedMetadataPhone(candidate) === normalizedPhone,
        );
        if (owner) return owner.id;
        if (users.length < perPage) break;
    }

    const { data: legacyProfiles, error: legacyError } = await admin
        .from('profiles')
        .select('id')
        .eq('phone', normalizedPhone)
        .eq('whatsapp_verified', true)
        .limit(1);
    if (legacyError) throw legacyError;
    return legacyProfiles?.[0]?.id ?? null;
}
