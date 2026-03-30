import crypto from 'crypto';

import { logDebug, logError } from '@/lib/log';

type AuthUserLike = {
    id: string;
    email?: string | null;
    phone?: string | null;
    user_metadata?: Record<string, unknown> | null;
};

export type WhatsAppSessionAdminClientLike = {
    auth: {
        admin: {
            getUserById: (id: string) => Promise<{ data?: { user?: AuthUserLike | null }; error?: { message?: string } | null }>;
            listUsers: () => Promise<{ data?: { users: AuthUserLike[] }; error?: { message?: string } | null }>;
            updateUserById: (id: string, payload: unknown) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
        };
    };
};

type Failure = {
    ok: false;
    error: string;
    message: string;
    details?: unknown;
    status: number;
};

function findUserByPhone(users: AuthUserLike[] | undefined, phoneE164: string) {
    return users?.find((user) => {
        if (user.phone === phoneE164) {
            return true;
        }

        const meta = user.user_metadata as { phone?: string } | undefined;
        return meta?.phone === phoneE164;
    });
}

export async function createWhatsAppSignInSession({
    admin,
    userId,
    phoneE164,
    randomHex = (size: number) => crypto.randomBytes(size).toString('hex'),
}: {
    admin: WhatsAppSessionAdminClientLike;
    userId?: string;
    phoneE164?: string;
    randomHex?: (size: number) => string;
}): Promise<
    | {
          ok: true;
          data: {
              email: string;
              password: string;
              needsSignIn: true;
          };
      }
    | Failure
> {
    let user: AuthUserLike | undefined | null;

    if (userId) {
        const { data: userData, error } = await admin.auth.admin.getUserById(userId);
        if (error || !userData?.user) {
            return {
                ok: false,
                error: 'not_found',
                message: 'Пользователь не найден',
                details: { code: 'user_not_found' },
                status: 404,
            };
        }
        user = userData.user;
    } else if (phoneE164) {
        const { data: users } = await admin.auth.admin.listUsers();
        user = findUserByPhone(users?.users, phoneE164);
        if (!user) {
            return {
                ok: false,
                error: 'not_found',
                message: 'Пользователь не найден',
                details: { code: 'user_not_found' },
                status: 404,
            };
        }
    } else {
        return {
            ok: false,
            error: 'validation',
            message: 'Номер телефона или ID пользователя обязательны',
            details: { code: 'missing_data' },
            status: 400,
        };
    }

    const tempPassword = randomHex(16);
    let emailToUse = user.email || null;

    if (!emailToUse) {
        const phoneDigits = user.phone?.replace(/[^0-9]/g, '') || user.id.replace(/-/g, '');
        emailToUse = `${phoneDigits}@whatsapp.kezek.kg`;

        logDebug('WhatsAppAuth', 'Creating temp email', { email: emailToUse });
        const { error } = await admin.auth.admin.updateUserById(user.id, {
            email: emailToUse,
            email_confirm: true,
        });

        if (error) {
            logError('WhatsAppAuth', 'Failed to add temp email', error);
        }
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, {
        password: tempPassword,
    });

    if (passwordError) {
        logError('WhatsAppAuth', 'Failed to set temp password', passwordError);
        return {
            ok: false,
            error: 'internal',
            message: `Не удалось создать сессию: ${passwordError.message}`,
            details: { code: 'password_failed' },
            status: 500,
        };
    }

    logDebug('WhatsAppAuth', 'Temp password set, returning credentials');

    return {
        ok: true,
        data: {
            email: emailToUse,
            password: tempPassword,
            needsSignIn: true,
        },
    };
}
