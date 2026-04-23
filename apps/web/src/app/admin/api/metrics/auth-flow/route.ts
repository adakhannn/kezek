import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logError, logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { validateQuery } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const authFlowQuerySchema = z.object({
    windowHours: z.coerce.number().int().min(1).max(168).optional().default(24),
});

type EventType =
    | 'telegram_mobile_login_started'
    | 'telegram_mobile_login_approved'
    | 'telegram_mobile_login_expired'
    | 'telegram_mobile_login_failed';

async function getEventCount(
    eventType: EventType,
    fromIso: string,
    toIso: string,
) {
    const serviceClient = getServiceClient();
    const { count, error } = await serviceClient
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', eventType)
        .gte('created_at', fromIso)
        .lt('created_at', toIso);

    if (error) {
        throw new Error(error.message);
    }

    return count ?? 0;
}

function buildSnapshot(
    started: number,
    approved: number,
    expired: number,
    failed: number,
) {
    const resolved = approved + expired + failed;
    const pending = Math.max(started - resolved, 0);
    const approvedRate = started > 0 ? approved / started : null;

    return {
        started,
        approved,
        expired,
        failed,
        resolved,
        pending,
        approvedRate,
    };
}

/**
 * GET /api/admin/metrics/auth-flow
 * Dashboard metrics for Telegram mobile auth flow.
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const queryValidation = validateQuery(url, authFlowQuerySchema);
        if (!queryValidation.success) {
            return queryValidation.response;
        }
        const { windowHours } = queryValidation.data;

        const now = new Date();
        const currentFrom = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
        const previousFrom = new Date(
            currentFrom.getTime() - windowHours * 60 * 60 * 1000,
        );

        const [
            currentStarted,
            currentApproved,
            currentExpired,
            currentFailed,
            previousStarted,
            previousApproved,
            previousExpired,
            previousFailed,
        ] = await Promise.all([
            getEventCount(
                'telegram_mobile_login_started',
                currentFrom.toISOString(),
                now.toISOString(),
            ),
            getEventCount(
                'telegram_mobile_login_approved',
                currentFrom.toISOString(),
                now.toISOString(),
            ),
            getEventCount(
                'telegram_mobile_login_expired',
                currentFrom.toISOString(),
                now.toISOString(),
            ),
            getEventCount(
                'telegram_mobile_login_failed',
                currentFrom.toISOString(),
                now.toISOString(),
            ),
            getEventCount(
                'telegram_mobile_login_started',
                previousFrom.toISOString(),
                currentFrom.toISOString(),
            ),
            getEventCount(
                'telegram_mobile_login_approved',
                previousFrom.toISOString(),
                currentFrom.toISOString(),
            ),
            getEventCount(
                'telegram_mobile_login_expired',
                previousFrom.toISOString(),
                currentFrom.toISOString(),
            ),
            getEventCount(
                'telegram_mobile_login_failed',
                previousFrom.toISOString(),
                currentFrom.toISOString(),
            ),
        ]);

        const current = buildSnapshot(
            currentStarted,
            currentApproved,
            currentExpired,
            currentFailed,
        );
        const previous = buildSnapshot(
            previousStarted,
            previousApproved,
            previousExpired,
            previousFailed,
        );

        logDebug('AdminAuthFlowMetricsAPI', 'Auth flow metrics fetched', {
            windowHours,
            current,
            previous,
        });

        return NextResponse.json({
            ok: true,
            data: {
                windowHours,
                ranges: {
                    current: {
                        from: currentFrom.toISOString(),
                        to: now.toISOString(),
                    },
                    previous: {
                        from: previousFrom.toISOString(),
                        to: currentFrom.toISOString(),
                    },
                },
                current,
                previous,
                deltas: {
                    started: current.started - previous.started,
                    approved: current.approved - previous.approved,
                    expired: current.expired - previous.expired,
                    failed: current.failed - previous.failed,
                    approvedRate:
                        current.approvedRate === null || previous.approvedRate === null
                            ? null
                            : current.approvedRate - previous.approvedRate,
                },
            },
        });
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        logError('AdminAuthFlowMetricsAPI', 'Unexpected error', { error });
        return NextResponse.json(
            { ok: false, error },
            { status: 500 },
        );
    }
}
