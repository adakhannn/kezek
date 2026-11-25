import {
    validatePublicContactPatch,
} from '@/lib/businessContacts';
import type { DbTableClient } from '@/lib/supabaseTypes';
import { businessSettingsPatchSchema } from '@/lib/validation/businessUpdateSchemas';

export type BusinessContactSettingsAdminLike = DbTableClient;

export async function updateBusinessContactSettings(params: {
    admin: BusinessContactSettingsAdminLike;
    bizId: string;
    input: unknown;
}) {
    const parsed = businessSettingsPatchSchema.safeParse(params.input);
    if (!parsed.success) {
        return { ok: false as const, status: 400, error: 'validation', message: parsed.error.issues[0].message };
    }
    const { tz, ...contacts } = parsed.data;
    const validation = validatePublicContactPatch(contacts);
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
        .update(tz === undefined ? validation.value : { ...validation.value, tz })
        .eq('id', params.bizId)
        .select('contact_phone,contact_whatsapp,contact_email,website_url,tz')
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
