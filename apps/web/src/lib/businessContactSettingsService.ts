import { DATABASE_FAILURE_MESSAGES, reportDatabaseError } from '@/lib/apiErrorHandler';
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
        // R25-12: the database refuses a zone change while future bookings exist.
        if (error.message?.includes('BUSINESS_TZ_HAS_FUTURE_BOOKINGS')) {
            return {
                ok: false as const,
                status: 409,
                error: 'tz_has_future_bookings',
                message: 'The time zone cannot change while upcoming bookings exist; their times would shift against the schedule.',
            };
        }
        return {
            ok: false as const,
            status: 400,
            error: 'update_failed',
            message: reportDatabaseError('BusinessContactSettings', error, DATABASE_FAILURE_MESSAGES.save),
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
