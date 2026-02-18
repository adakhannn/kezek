// apps/web/src/app/api/auth/whatsapp/create-session/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { validateRequest } from '@/lib/validation/apiValidation';
import { createWhatsAppSessionSchema } from '@/lib/validation/schemas';

/**
 * POST /api/auth/whatsapp/create-session
 * Создает сессию для пользователя после проверки OTP через WhatsApp
 * Использует Admin API для генерации access token
 */
export async function POST(req: Request) {
    // Применяем rate limiting для создания сессии после OTP
    return withRateLimit(
        req,
        RateLimitConfigs.auth,
        () => withErrorHandler('WhatsAppAuth', async () => {
        // Валидация запроса
        const validationResult = await validateRequest(req, createWhatsAppSessionSchema);
        if (!validationResult.success) {
            return validationResult.response;
        }
        const { phone, userId } = validationResult.data;

        // Используем унифицированную утилиту для создания admin клиента
        const admin = createSupabaseAdminClient();

        // Находим пользователя
        let user;
        if (userId) {
            const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
            if (userError || !userData?.user) {
                return createErrorResponse('not_found', 'Пользователь не найден', { code: 'user_not_found' }, 404);
            }
            user = userData.user;
        } else if (phone) {
            const phoneE164 = normalizePhoneToE164(phone);
            if (!phoneE164) {
                return createErrorResponse('validation', 'Неверный формат номера телефона', { code: 'invalid_phone' }, 400);
            }

            const { data: users } = await admin.auth.admin.listUsers();
            user = users?.users.find((u) => {
                if (u.phone === phoneE164) return true;
                const meta = u.user_metadata as { phone?: string } | undefined;
                if (meta?.phone === phoneE164) return true;
                return false;
            });

            if (!user) {
                return createErrorResponse('not_found', 'Пользователь не найден', { code: 'user_not_found' }, 404);
            }
        } else {
            return createErrorResponse('validation', 'Номер телефона или ID пользователя обязательны', { code: 'missing_data' }, 400);
        }

        // Генерируем magic link для создания сессии
        // Но generateLink работает только с email, поэтому используем другой подход
        // Используем Admin API для создания access token напрямую
        
        // Альтернативный подход: используем signInWithPassword с временным паролем
        // Но это не идеально, так как требует установки пароля
        
        // Лучший подход: используем Admin API для генерации access token
        // Но для этого нужно использовать другой метод
        
        // Временно: используем generateLink с email, если он есть
        // Если email нет, создаем временный email или используем другой метод
        
        // Используем подход с временным паролем для создания сессии
        // Это работает надежнее, чем magic link, так как не зависит от email
        
        // Генерируем временный пароль
        const tempPassword = crypto.randomBytes(16).toString('hex');
        
        // Устанавливаем временный пароль для пользователя
        // Если у пользователя нет email, создаем временный
        let emailToUse = user.email;
        if (!emailToUse) {
            const phoneDigits = user.phone?.replace(/[^0-9]/g, '') || user.id.replace(/-/g, '');
            emailToUse = `${phoneDigits}@whatsapp.kezek.kg`;
            
            logDebug('WhatsAppAuth', 'Creating temp email', { email: emailToUse });
            
            // Обновляем пользователя, добавляя временный email
            const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
                email: emailToUse,
                email_confirm: true,
            });
            
            if (updateError) {
                logError('WhatsAppAuth', 'Failed to add temp email', updateError);
                // Продолжаем, даже если не удалось добавить email
            }
        }
        
        // Устанавливаем временный пароль
        const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, {
            password: tempPassword,
        });
        
        if (passwordError) {
            logError('WhatsAppAuth', 'Failed to set temp password', passwordError);
            return createErrorResponse('internal', `Не удалось создать сессию: ${passwordError.message}`, { code: 'password_failed' }, 500);
        }
        
        logDebug('WhatsAppAuth', 'Temp password set, returning credentials');
        
        // Возвращаем email и пароль для входа на клиенте
        return createSuccessResponse({
            email: emailToUse,
            password: tempPassword,
            needsSignIn: true,
        });
    })
    );
}

