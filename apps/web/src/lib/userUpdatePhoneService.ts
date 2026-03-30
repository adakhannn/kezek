type UserUpdatePhoneFailure = {
    ok: false;
    status: 400 | 401;
    error: 'validation' | 'auth';
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
