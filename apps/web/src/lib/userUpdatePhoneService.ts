type UserUpdatePhoneFailure = {
    ok: false;
    status: 400 | 401 | 409;
    error: 'validation' | 'auth' | 'conflict';
    message: string;
};

export const CONFIRMED_PHONE_CHANGE_MESSAGE = 'Подтверждённый номер нельзя заменить без кода из SMS на новый номер';

type UserUpdatePhoneSuccess = {
    ok: true;
};

export type UserUpdatePhoneResult = UserUpdatePhoneFailure | UserUpdatePhoneSuccess;

export async function runUserUpdatePhone({
    supabase,
    admin,
    phone,
}: {
    supabase: any;
    admin: any;
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
    // (ARCH-01). This route therefore only sets a phone on an account without a confirmed one; the
    // SMS code that follows confirms it.
    if (user.phone_confirmed_at) {
        return {
            ok: false,
            status: 409,
            error: 'conflict',
            message: CONFIRMED_PHONE_CHANGE_MESSAGE,
        };
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        phone: normalizedPhone,
        phone_confirm: false,
    });

    if (updateError) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: updateError.message,
        };
    }

    return { ok: true };
}
