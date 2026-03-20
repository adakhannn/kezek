import {
    createBookingUseCase,
    type BookingNotificationPort,
} from '@core-domain/booking';
import { createClient } from '@supabase/supabase-js';

import {
    withErrorHandler,
    createErrorResponse,
    createSuccessResponse,
} from '@/lib/apiErrorHandler';
import { createBookingNotificationHttpAdapter } from '@/app/api/_shared/bookingNotificationHttpAdapter';
import { createSupabaseBookingCommands } from '@/lib/bookingCommandsSupabase';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { SupabaseBranchRepository } from '@/lib/repositories';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { validateRequest } from '@/lib/validation/apiValidation';
import { quickHoldSchema } from '@/lib/validation/bookingSchemas';

/**
 * @swagger
 * /api/quick-hold:
 *   post:
 *     summary: Р‘С‹СЃС‚СЂРѕРµ СЃРѕР·РґР°РЅРёРµ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ (hold) РґР»СЏ Р°РІС‚РѕСЂРёР·РѕРІР°РЅРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - biz_id
 *               - service_id
 *               - staff_id
 *               - start_at
 *             properties:
 *               biz_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID Р±РёР·РЅРµСЃР°
 *               branch_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID С„РёР»РёР°Р»Р° (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ, РµСЃР»Рё РЅРµ СѓРєР°Р·Р°РЅ - Р±РµСЂРµС‚СЃСЏ РїРµСЂРІС‹Р№ Р°РєС‚РёРІРЅС‹Р№)
 *               service_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID СѓСЃР»СѓРіРё
 *               staff_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID РјР°СЃС‚РµСЂР°
 *               start_at:
 *                 type: string
 *                 format: date-time
 *                 description: Р’СЂРµРјСЏ РЅР°С‡Р°Р»Р° РІ С„РѕСЂРјР°С‚Рµ ISO СЃ С‚Р°Р№РјР·РѕРЅРѕР№
 *                 example: "2024-01-15T10:00:00+06:00"
 *     responses:
 *       '200':
 *         description: Р‘СЂРѕРЅРёСЂРѕРІР°РЅРёРµ СѓСЃРїРµС€РЅРѕ СЃРѕР·РґР°РЅРѕ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 booking_id:
 *                   type: string
 *                   format: uuid
 *                 confirmed:
 *                   type: boolean
 *                   example: true
 *       '400':
 *         description: РќРµРІРµСЂРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹ РёР»Рё РѕС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '401':
 *         description: РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '429':
 *         description: РџСЂРµРІС‹С€РµРЅ Р»РёРјРёС‚ Р·Р°РїСЂРѕСЃРѕРІ
 */
export async function POST(req: Request) {
    // РџСЂРёРјРµРЅСЏРµРј rate limiting РґР»СЏ РїСѓР±Р»РёС‡РЅРѕРіРѕ endpoint
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        async () => {
            return withErrorHandler('QuickHold', async () => {
            const url = getSupabaseUrl();
            const anon = getSupabaseAnonKey();
            
            // РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё Bearer token РІ Р·Р°РіРѕР»РѕРІРєР°С… (РґР»СЏ РјРѕР±РёР»СЊРЅРѕРіРѕ РїСЂРёР»РѕР¶РµРЅРёСЏ)
            const authHeader = req.headers.get('Authorization');
            const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            
    let supabase;
    let user;
            
            if (bearerToken) {
        // Р”Р»СЏ РјРѕР±РёР»СЊРЅРѕРіРѕ РїСЂРёР»РѕР¶РµРЅРёСЏ: СЃРѕР·РґР°РµРј РєР»РёРµРЅС‚ СЃ С‚РѕРєРµРЅРѕРј РІ Р·Р°РіРѕР»РѕРІРєР°С…
        supabase = createClient(url, anon, {
            global: {
                headers: {
                    Authorization: `Bearer ${bearerToken}`,
                },
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
        // РџСЂРѕРІРµСЂСЏРµРј С‚РѕРєРµРЅ С‡РµСЂРµР· getUser (РѕРЅ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РёСЃРїРѕР»СЊР·СѓРµС‚ С‚РѕРєРµРЅ РёР· Р·Р°РіРѕР»РѕРІРєРѕРІ)
        const {data: {user: userData}, error: userError} = await supabase.auth.getUser();
        if (userError || !userData) {
            logError('QuickHold', 'Bearer token auth failed', {
                error: userError?.message || 'No user',
                hasToken: !!bearerToken,
                tokenLength: bearerToken?.length,
                // РўРѕРєРµРЅ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё Р·Р°РјР°СЃРєРёСЂСѓРµС‚СЃСЏ С‡РµСЂРµР· sanitizeObject
            });
            return createErrorResponse('auth', 'Not signed in', undefined, 401);
        }
        user = userData;
        logDebug('QuickHold', 'Bearer token auth successful', { userId: user.id });
    } else {
        // Р”Р»СЏ РІРµР±-РІРµСЂСЃРёРё: РёСЃРїРѕР»СЊР·СѓРµРј СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅСѓСЋ СѓС‚РёР»РёС‚Сѓ
        supabase = await createSupabaseServerClient();
        const {data: {user: userData}} = await supabase.auth.getUser();
        if (!userData) {
            return createErrorResponse('auth', 'Not signed in', undefined, 401);
        }
        user = userData;
    }

    // Р’Р°Р»РёРґР°С†РёСЏ РІС…РѕРґРЅС‹С… РґР°РЅРЅС‹С… С‡РµСЂРµР· Zod СЃС…РµРјСѓ
    const validationResult = await validateRequest(req, quickHoldSchema);
    if (!validationResult.success) {
        return validationResult.response;
    }
    
    // Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅР°СЏ РґРѕРјРµРЅРЅР°СЏ РІР°Р»РёРґР°С†РёСЏ (СЃС‚СЂСѓРєС‚СѓСЂР°/Р±РёР·РЅРµСЃ-РёРЅРІР°СЂРёР°РЅС‚С‹)
    const body = validationResult.data;

    const branchRepository = new SupabaseBranchRepository(supabase);
    const commands = createSupabaseBookingCommands(supabase, { userId: user.id });

    const notifications: BookingNotificationPort = createBookingNotificationHttpAdapter(
        req,
        'QuickHold',
    );

    const result = await createBookingUseCase(
        {
            branchRepository,
            commands,
            notifications,
        },
        body,
    );

            if (!result.ok) {
                const kind = result.error.kind;
                const baseMessage =
                    kind === 'BRANCH_NOT_FOUND_OR_INACTIVE'
                        ? 'Р¤РёР»РёР°Р» РЅРµ РЅР°Р№РґРµРЅ РёР»Рё РЅРµР°РєС‚РёРІРµРЅ'
                        : kind === 'NO_ACTIVE_BRANCH_FOR_BIZ'
                        ? 'Р”Р»СЏ РІС‹Р±СЂР°РЅРЅРѕРіРѕ Р±РёР·РЅРµСЃР° РЅРµС‚ Р°РєС‚РёРІРЅС‹С… С„РёР»РёР°Р»РѕРІ'
                        : 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёРµ';

                return createErrorResponse(
                    'validation',
                    result.error.message || baseMessage,
                    { kind },
                    400,
                );
            }

            return createSuccessResponse({
                booking_id: result.bookingId,
                confirmed: true,
            });
            });
        }
    );
}




