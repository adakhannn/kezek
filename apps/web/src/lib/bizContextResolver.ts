import type { SupabaseClient } from '@supabase/supabase-js';

import { BizAccessError } from './authDiagnostics';
import {
    type BizContextDiagnostics,
    resolveForSuperAdmin,
    resolveFromCurrentBusiness,
    resolveFromOwnerId,
    resolveFromUserRoles,
} from './bizContextResolutionStrategies';
import {
    buildNoBizAccessDiagnostics,
    checkIsSuperAdmin,
    createBizServiceClient,
    getBizResolutionMethod,
} from './bizContextRuntimeHelpers';
import { logDebug, logError, logWarn } from './log';
import { createSupabaseServerClient } from './supabaseHelpers';

export type ManagerBusinessContext = {
    id: string;
    name: string | null;
    /**
     * Reserved for presentation until city_id is resolved through a canonical
     * city directory. The businesses table intentionally has no text city
     * column, so callers must not make a PostgREST selection for `city`.
     */
    city: string | null;
    slug: string | null;
    rating_score: number | null;
    tz: string | null;
    owner_id: string | null;
    branch_limit: number | null;
    contact_phone: string | null;
    contact_whatsapp: string | null;
    contact_email: string | null;
    website_url: string | null;
};

/**
 * Выбор текущего бизнеса для кабинета менеджмента.
 * Логика перенесена из getBizContextForManagers (authBiz.ts).
 * Использует подфункции: resolveForSuperAdmin, resolveFromCurrentBusiness, resolveFromUserRoles, resolveFromOwnerId.
 * @see docs/BIZ_CONTEXT_RESOLVER_ADR.md — приоритеты выбора и сценарии.
 */
export async function resolveBizContextForManagers() {
    const startTime = Date.now();
    const supabase = await createSupabaseServerClient();

    logDebug('AuthBiz', 'Starting business context resolution');
    const { data: userData, error: eUser } = await supabase.auth.getUser();
    if (eUser) {
        logError('AuthBiz', 'User authentication failed', {
            error: eUser?.message,
            hasUser: !!userData?.user,
            errorCode: eUser?.code,
            errorStatus: eUser?.status,
        });
        const authStatus = typeof eUser.status === 'number' ? eUser.status : 0;
        const authCode = typeof eUser.code === 'string' ? eUser.code : '';
        const isRejectedSession = authStatus === 401 || authStatus === 403 || authCode === 'session_not_found';
        if (!isRejectedSession) {
            throw new BizAccessError('SERVICE_UNAVAILABLE', 'AUTH_SERVICE_UNAVAILABLE');
        }
        throw new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED');
    }
    if (!userData?.user) {
        throw new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED');
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email;
    logDebug('AuthBiz', 'User authenticated', { userId, email: userEmail });

    const serviceClient: SupabaseClient = await createBizServiceClient(supabase);
    const isSuper = await checkIsSuperAdmin({ supabase, userId });

    let bizId: string | undefined;
    const diagnostics: BizContextDiagnostics = {
        checkedSuperAdmin: isSuper,
        checkedUserRoles: false,
        checkedOwnerId: false,
    };

    if (isSuper) {
        bizId = await resolveForSuperAdmin(serviceClient, userId);
    } else {
        bizId = await resolveFromCurrentBusiness(serviceClient, userId, diagnostics);
        const shouldAutoSelect = !diagnostics.hasCurrentBizRecord;
        if (!bizId && shouldAutoSelect) {
            bizId = await resolveFromUserRoles(serviceClient, userId, diagnostics);
        }
        if (!bizId && shouldAutoSelect) {
            bizId = await resolveFromOwnerId(serviceClient, userId, diagnostics);
        }
    }

    if (!bizId) {
        const totalTime = Date.now() - startTime;
        const diagnosticsData = buildNoBizAccessDiagnostics(diagnostics);
        logError('AuthBiz', 'NO_BIZ_ACCESS: Business not found for user', {
            userId,
            userEmail,
            isSuperAdmin: isSuper,
            diagnostics: {
                ...diagnostics,
                totalResolutionTimeMs: totalTime,
            },
            resolutionSteps: diagnosticsData,
        });
        throw new BizAccessError('NO_BIZ_ACCESS', undefined, diagnosticsData);
    }

    const totalTime = Date.now() - startTime;
    logDebug('AuthBiz', 'Business context resolved successfully', {
        userId,
        userEmail,
        bizId,
        isSuperAdmin: isSuper,
        resolutionTimeMs: totalTime,
        resolutionMethod: getBizResolutionMethod({ isSuper, diagnostics }),
    });
    // Business identity is part of the already-authorized context. Resolve it
    // with the same narrowly scoped client used above so dashboard pages do not
    // repeat RLS-sensitive identity lookups or receive a service client.
    const businessResult = await serviceClient
        .from('businesses')
        .select('id,name,slug,rating_score,tz,owner_id,branch_limit,contact_phone,contact_whatsapp,contact_email,website_url')
        .eq('id', bizId)
        .maybeSingle<Omit<ManagerBusinessContext, 'city'>>();
    const business = businessResult.data
        ? { ...businessResult.data, city: null }
        : null;

    if (!business) {
        logWarn('AuthBiz', 'Resolved business metadata is unavailable', {
            userId,
            bizId,
            error: businessResult.error?.message,
            errorCode: businessResult.error?.code,
        });
    }

    return { supabase, userId, bizId, business };
}

