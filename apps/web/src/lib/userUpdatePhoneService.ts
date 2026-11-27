import type { SupabaseClient } from '@supabase/supabase-js';

import { reportDatabaseError } from '@/lib/apiErrorHandler';

type UserUpdatePhoneFailure = {
    ok: false;
    status: 400 | 401 | 500;
    error: 'validation' | 'auth' | 'internal';
    message: string;
};

type UserUpdatePhoneSuccess = {
    ok: true;
};

export type UserUpdatePhoneResult = UserUpdatePhoneFailure | UserUpdatePhoneSuccess;

export async function runUserUpdatePhone({
    supabase,
    admin,
    phone,
}: {
    supabase: SupabaseClient;
    admin: SupabaseClient;
    phone: unknown;
}): Promise<UserUpdatePhoneResult> {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;

    if (!user) {
        return {
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Не авторизован',
        };
    }

    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
    if (!normalizedPhone) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Телефон обязателен',
        };
    }

    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Некорректный формат телефона',
        };
    }

    const digits = (value: unknown) => (typeof value === 'string' ? value.replace(/\D/g, '') : '');
    if (digits(user.phone) === digits(normalizedPhone)) {
        return { ok: true };
    }

    // GoTrue keeps phone_confirmed_at when the admin API replaces the number, so a new number set
    // here would look confirmed without any code, and exact contact lookups trust confirmed phones
    // (ARCH-01). The previous number is released first (release_auth_phone, API-10): the new one
    // starts unconfirmed and the SMS code that follows confirms it.
    const previousDigits = digits(user.phone);
    if (/^\d{8,15}$/.test(previousDigits)) {
        const { error: releaseError } = await admin.rpc('release_auth_phone', { p_user_id: user.id, p_phone_digits: previousDigits });
        if (releaseError) {
            return {
                ok: false,
                status: 500,
                error: 'internal',
                message: 'Не удалось обновить телефон',
            };
        }
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        phone: normalizedPhone,
        phone_confirm: false,
    });

    if (updateError) {
        // Supabase Auth: the number belongs to another account (code phone_exists).
        const taken = (updateError as { code?: unknown }).code === 'phone_exists';
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: taken
                ? 'Этот номер телефона уже привязан к другому аккаунту.'
                : reportDatabaseError('UserUpdatePhone', updateError, 'Не удалось обновить телефон'),
        };
    }

    return { ok: true };
}
