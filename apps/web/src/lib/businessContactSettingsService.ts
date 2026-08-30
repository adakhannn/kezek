import {
    type PublicContactFields,
    validatePublicContacts,
} from '@/lib/businessContacts';

export type BusinessContactSettingsAdminLike = {
    // Kept structurally small so this service can be unit-tested without
    // coupling to the generated Supabase client type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

export async function updateBusinessContactSettings(params: {
    admin: BusinessContactSettingsAdminLike;
    bizId: string;
    input: PublicContactFields;
}) {
    const validation = validatePublicContacts(params.input);
    if (!validation.ok) {
        return {
            ok: false as const,
            status: 400,
            error: 'validation',
            field: validation.field,
            message: validation.message,
        };
    }

    const { data, error } = await params.admin
        .from('businesses')
        .update(validation.value)
        .eq('id', params.bizId)
        .select('contact_phone,contact_whatsapp,contact_email,website_url')
        .maybeSingle();

    if (error) {
        return {
            ok: false as const,
            status: 400,
            error: 'update_failed',
            message: error.message,
        };
    }
    if (!data) {
        return {
            ok: false as const,
            status: 404,
            error: 'not_found',
            message: 'Бизнес не найден',
        };
    }

    return { ok: true as const, data };
}
