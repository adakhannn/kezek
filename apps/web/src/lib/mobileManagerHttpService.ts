import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { bookingCancellationError } from '@/lib/bookingCancellationError';
import { dispatchBookingNotification } from '@/lib/bookingNotificationDispatch';
import { managerAccessToBusiness } from '@/lib/businessManagerAccess';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { resolveMobileBookingAuth } from '@/lib/mobileBookingAuthService';
import { listManagedBusinesses, listManagerBookings, parseManagerBookingsQuery } from '@/lib/mobileManagerService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

async function auth(req: Request) {
    return resolveMobileBookingAuth({
        authorizationHeader: req.headers.get('Authorization'),
        supabaseUrl: getSupabaseUrl(),
        anonKey: getSupabaseAnonKey(),
        createServerClient: createSupabaseServerClient,
    });
}

/** GET /api/mobile/manager/businesses: the businesses the caller owns or manages (O1, O3). */
export async function runListManagedBusinessesHttp(req: Request): Promise<NextResponse> {
    const authResult = await auth(req);
    if (!authResult.ok) return createErrorResponse(authResult.error, authResult.message, undefined, authResult.status);
    const result = await listManagedBusinesses({ admin: createSupabaseAdminClient(), userId: authResult.user.id });
    if (!result.ok) return createErrorResponse(result.error, result.message, undefined, result.status);
    return createSuccessResponse(result.data);
}

/** GET /api/mobile/manager/bookings?bizId=&scope=today|upcoming&limit=&offset= (O1). */
export async function runListManagerBookingsHttp(req: Request): Promise<NextResponse> {
    const authResult = await auth(req);
    if (!authResult.ok) return createErrorResponse(authResult.error, authResult.message, undefined, authResult.status);
    const query = parseManagerBookingsQuery(new URL(req.url).searchParams);
    if (!query) return createErrorResponse('validation', 'Укажите бизнес и раздел списка записей', undefined, 400);
    const result = await listManagerBookings({ admin: createSupabaseAdminClient(), userId: authResult.user.id, query });
    if (!result.ok) return createErrorResponse(result.error, result.message, undefined, result.status);
    return createSuccessResponse(result.data, { page: result.page, timezone: result.timezone });
}

function confirmError(error: unknown): NextResponse {
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    if (message.startsWith('Booking status cannot be changed')) {
        return createErrorResponse('not_confirmable', 'Подтвердить можно только запись в ожидании', undefined, 409);
    }
    if (message === 'BOOKING_FORBIDDEN') return createErrorResponse('forbidden', 'Нет доступа к подтверждению этой записи', undefined, 403);
    if (message === 'BOOKING_CHANGED') return createErrorResponse('booking_changed', 'Запись изменилась. Обновите её перед подтверждением.', undefined, 409);
    const known = bookingCancellationError(error);
    if (known?.error === 'not_found') return createErrorResponse(known.error, known.message, undefined, known.status);
    return createErrorResponse('internal', 'Внутренняя ошибка сервера', undefined, 500);
}

/**
 * POST /api/bookings/[id]/confirm: a manager confirms a pending booking (O1), from the app (Bearer)
 * or the website (cookie). Allowed to the owner, admin or manager of the booking's business
 * (managerAccessToBusiness); the checked confirm_booking RPC runs as the caller and its trigger
 * queues the notification, which is dispatched again idempotently, like the dashboard does.
 */
export async function runConfirmBookingHttp(req: Request, context: unknown): Promise<NextResponse> {
    const bookingId = await getRouteParamUuid(context, 'id');
    const authResult = await auth(req);
    if (!authResult.ok) return createErrorResponse(authResult.error, authResult.message, undefined, authResult.status);

    const admin = createSupabaseAdminClient();
    const { data: booking, error } = await admin.from('bookings').select('id, biz_id, status').eq('id', bookingId).maybeSingle();
    if (error) return createErrorResponse('internal', 'Внутренняя ошибка сервера', undefined, 500);
    if (!booking?.biz_id) return createErrorResponse('not_found', 'Бронирование не найдено', undefined, 404);
    if ((await managerAccessToBusiness(admin, authResult.user.id, String(booking.biz_id))) !== 'manager') {
        return createErrorResponse('forbidden', 'Нет доступа к подтверждению этой записи', undefined, 403);
    }
    if (booking.status === 'confirmed') return createSuccessResponse({ confirmed: true, alreadyConfirmed: true });
    if (booking.status !== 'hold') return createErrorResponse('not_confirmable', 'Подтвердить можно только запись в ожидании', undefined, 409);

    const { error: rpcError } = await authResult.client.rpc('confirm_booking', { p_booking_id: bookingId });
    if (rpcError) return confirmError(rpcError);
    await dispatchBookingNotification(authResult.client, bookingId, 'confirm');
    return createSuccessResponse({ confirmed: true, alreadyConfirmed: false });
}
