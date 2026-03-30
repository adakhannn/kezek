import { logDebug, logError } from '@/lib/log';

export type SupabaseAdminClientLike = {
    from: (table: string) => any;
    auth: {
        admin: {
            listUsers: () => Promise<{ data?: { users: AuthUser[] }; error?: { message?: string } | null }>;
            updateUserById: (id: string, payload: unknown) => Promise<unknown>;
            createUser: (payload: unknown) => Promise<{ data?: { user?: AuthUser }; error?: { message?: string } | null }>;
        };
    };
};

type AuthUser = {
    id: string;
    phone?: string | null;
    user_metadata?: Record<string, unknown> | null;
};

type VerifyOtpLoginInput = {
    admin: SupabaseAdminClientLike;
    phoneE164: string;
    code: string;
};

type VerifyOtpLoginSuccess = {
    ok: true;
    data: {
        message: string;
        userId: string;
        phone: string;
        isNewUser: boolean;
    };
};

type VerifyOtpLoginFailure = {
    ok: false;
    error: string;
    message: string;
    details?: unknown;
    status: number;
};

type VerifyOtpLoginResult =
    | {
          ok: true;
          data: VerifyOtpLoginSuccess['data'];
      }
    | VerifyOtpLoginFailure;

type ResolveOrCreateUserResult =
    | {
          user: AuthUser;
          isNewUser: boolean;
      }
    | {
          error: VerifyOtpLoginFailure;
      };

function findUserByPhone(users: AuthUser[] | undefined, phoneE164: string) {
    return users?.find((user) => {
        if (user.phone === phoneE164) {
            return true;
        }

        const meta = user.user_metadata as { phone?: string } | undefined;
        if (meta?.phone === phoneE164) {
            return true;
        }

        const normalizedPhone = user.phone?.replace(/\s/g, '').replace(/^\+/, '');
        const normalizedE164 = phoneE164.replace(/\s/g, '').replace(/^\+/, '');
        return normalizedPhone === normalizedE164;
    });
}

async function lookupOtpRecord(admin: SupabaseAdminClientLike, phoneE164: string, code: string) {
    const otpQuery = admin
        .from('whatsapp_otp_codes')
        .select('*')
        .eq('phone', phoneE164)
        .eq('code', code)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

    return otpQuery.maybeSingle() as Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
}

async function markOtpUsed(admin: SupabaseAdminClientLike, otpId: string) {
    await admin.from('whatsapp_otp_codes').update({ used_at: new Date().toISOString() }).eq('id', otpId);
}

async function resolveOtpValidity(admin: SupabaseAdminClientLike, phoneE164: string, code: string) {
    const { data: otpRecord, error: otpError } = await lookupOtpRecord(admin, phoneE164, code);

    if (otpError && !otpError.message?.includes('does not exist')) {
        logError('WhatsAppAuth', 'OTP lookup error', otpError);
    }

    if (otpRecord) {
        await markOtpUsed(admin, otpRecord.id);
        return true;
    }

    const { data: users } = await admin.auth.admin.listUsers();
    const user = findUserByPhone(users?.users, phoneE164);

    if (!user) {
        return false;
    }

    const userMeta = (user.user_metadata || {}) as {
        whatsapp_auth_otp?: string;
        whatsapp_auth_otp_expires?: string;
    };

    const savedCode = userMeta.whatsapp_auth_otp;
    const expiresAt = userMeta.whatsapp_auth_otp_expires;

    if (savedCode === code && expiresAt && new Date(expiresAt) > new Date()) {
        await admin.auth.admin.updateUserById(user.id, {
            user_metadata: {
                ...userMeta,
                whatsapp_auth_otp: null,
                whatsapp_auth_otp_expires: null,
            },
        });
        return true;
    }

    return false;
}

async function resolveOrCreateUser(admin: SupabaseAdminClientLike, phoneE164: string): Promise<ResolveOrCreateUserResult> {
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    let user = findUserByPhone(existingUsers?.users, phoneE164);
    let isNewUser = false;

    if (user) {
        logDebug('WhatsAppAuth', 'Found existing user', { userId: user.id });
        return { user, isNewUser };
    }

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        phone: phoneE164,
        phone_confirm: true,
        user_metadata: {
            phone: phoneE164,
        },
    });

    if (!createError) {
        user = newUser?.user;
        if (user) {
            isNewUser = true;
            logDebug('WhatsAppAuth', 'New user created', { userId: user.id });
            return { user, isNewUser };
        }
    }

    if (
        createError?.message?.includes('already registered') ||
        createError?.message?.includes('already exists') ||
        createError?.message?.includes('Phone number already registered')
    ) {
        const { data: allUsers } = await admin.auth.admin.listUsers();
        user = findUserByPhone(allUsers?.users, phoneE164);

        if (user) {
            logDebug('WhatsAppAuth', 'Found existing user after create error', { userId: user.id });
            return { user, isNewUser };
        }

        logError('WhatsAppAuth', 'Phone already registered but user not found', {
            phone: phoneE164,
            availableUsers: allUsers?.users?.map((entry) => ({
                id: entry.id,
                phone: entry.phone,
                meta: entry.user_metadata,
            })),
        });

        return {
            error: {
                ok: false as const,
                error: 'conflict',
                message:
                    'Этот номер телефона уже зарегистрирован. Если это ваш номер, попробуйте войти через стандартную форму входа.',
                details: { code: 'phone_taken' },
                status: 409,
            },
        };
    }

    logError('WhatsAppAuth', 'Create user error', createError);
    return {
        error: {
            ok: false as const,
            error: 'internal',
            message: createError?.message || 'Не удалось создать пользователя',
            details: { code: 'create_failed' },
            status: 500,
        },
    };
}

export async function verifyWhatsAppOtpLogin({
    admin,
    phoneE164,
    code,
}: VerifyOtpLoginInput): Promise<VerifyOtpLoginResult> {
    const isValidOtp = await resolveOtpValidity(admin, phoneE164, code);

    if (!isValidOtp) {
        return {
            ok: false,
            error: 'validation',
            message: 'Неверный или истекший код. Запросите новый код.',
            details: { code: 'invalid_code' },
            status: 400,
        };
    }

    const userResolution = await resolveOrCreateUser(admin, phoneE164);
    if ('error' in userResolution) {
        return userResolution.error;
    }

    const { user, isNewUser } = userResolution;

    await admin.from('profiles').upsert(
        {
            id: user.id,
            phone: phoneE164,
            whatsapp_verified: true,
        },
        {
            onConflict: 'id',
        }
    );

    return {
        ok: true,
        data: {
            message: isNewUser ? 'Регистрация успешна' : 'Вход выполнен успешно',
            userId: user.id,
            phone: phoneE164,
            isNewUser,
        },
    };
}
