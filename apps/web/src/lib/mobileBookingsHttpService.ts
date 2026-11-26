import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { managerAccessToBusiness } from '@/lib/businessManagerAccess';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { resolveMobileBookingAuth } from '@/lib/mobileBookingAuthService';
import {
    cancelMobileBooking,
    getMobileBookingDetails,
    listMobileBookings,
    parseMobileBookingsPage,
} from '@/lib/mobileBookingsService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function runListMobileBookingsHttp(req: Request): Promise<NextResponse> {
    const authResult = await resolveMobileBookingAuth({
        authorizationHeader: req.headers.get('Authorization'),
        supabaseUrl: getSupabaseUrl(),
        anonKey: getSupabaseAnonKey(),
        createServerClient: createSupabaseServerClient,
    });

    if (!authResult.ok) {
        return createErrorResponse(authResult.error, authResult.message, undefined, authResult.status);
    }

    // ?limit=&offset= page the history (B11); without them the first 50, as before.
    const { limit, offset } = parseMobileBookingsPage(new URL(req.url).searchParams);
    const result = await listMobileBookings({
        client: authResult.client,
        userId: authResult.user.id,
        limit,
        offset,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data, { page: result.page });
}

export async function runGetMobileBookingDetailsHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    const authResult = await resolveMobileBookingAuth({
        authorizationHeader: req.headers.get('Authorization'),
        supabaseUrl: getSupabaseUrl(),
        anonKey: getSupabaseAnonKey(),
        createServerClient: createSupabaseServerClient,
    });

    if (!authResult.ok) {
        return createErrorResponse(authResult.error, authResult.message, undefined, authResult.status);
    }

    const userId = authResult.user.id;
    const result = await getMobileBookingDetails({
        client: authResult.client,
        userId,
        bookingId: await getRouteParamUuid(context, 'id'),
        // B1: a manager's push opens the booking too; the role check reads with the service role.
        isBusinessManager: async (bizId) =>
            (await managerAccessToBusiness(createSupabaseAdminClient(), userId, bizId)) === 'manager',
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
}

export async function runCancelMobileBookingHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    const authResult = await resolveMobileBookingAuth({
        authorizationHeader: req.headers.get('Authorization'),
        supabaseUrl: getSupabaseUrl(),
        anonKey: getSupabaseAnonKey(),
        createServerClient: createSupabaseServerClient,
    });

    if (!authResult.ok) {
        return createErrorResponse(authResult.error, authResult.message, undefined, authResult.status);
    }

    const result = await cancelMobileBooking({
        client: authResult.client,
        userId: authResult.user.id,
        bookingId: await getRouteParamUuid(context, 'id'),
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse({
        alreadyCancelled: result.alreadyCancelled ?? false,
    });
}
