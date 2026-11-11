import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
import {
    createErrorResponse,
    createSuccessResponse,
} from '@/lib/apiErrorHandler';
import { runNotifyPing } from '@/lib/notifyPingService';

const pingSchema = z.object({ to: z.string().trim().email().max(254).optional() }).strict();

export async function runNotifyPingHttp(req: Request): Promise<NextResponse> {
    const access = await requireCurrentSuperAdmin();
    if (!access.ok) return access.response;
    const body = pingSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return createErrorResponse('validation', 'Некорректный запрос', undefined, 400);
    const email = access.user.email?.trim().toLowerCase();
    if (!email || !access.user.email_confirmed_at) {
        return createErrorResponse('forbidden', 'Требуется подтвержденный email текущего администратора', undefined, 403);
    }
    if (body.data.to && body.data.to.toLowerCase() !== email) {
        return createErrorResponse('forbidden', 'Диагностическое письмо разрешено только на ваш email', undefined, 403);
    }

    const result = await runNotifyPing({
        to: email,
        env: process.env,
    });

    if (!result.ok) {
        return createErrorResponse(
            result.error,
            result.message,
            result.details,
            result.status,
        );
    }

    return createSuccessResponse(result.payload);
}
