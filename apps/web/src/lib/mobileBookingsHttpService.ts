import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { resolveMobileBookingAuth } from '@/lib/mobileBookingAuthService';
import { cancelMobileBooking, getMobileBookingDetails, listMobileBookings } from '@/lib/mobileBookingsService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

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

    const result = await listMobileBookings({
        client: authResult.client as never,
        userId: authResult.user.id,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
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

    const result = await getMobileBookingDetails({
        client: authResult.client as never,
        userId: authResult.user.id,
        bookingId: await getRouteParamUuid(context, 'id'),
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
        client: authResult.client as never,
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
