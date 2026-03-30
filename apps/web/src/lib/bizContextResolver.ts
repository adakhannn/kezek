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
import { logDebug, logError } from './log';
import { createSupabaseServerClient } from './supabaseHelpers';

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
    if (eUser || !userData?.user) {
        logError('AuthBiz', 'User authentication failed', {
            error: eUser?.message,
            hasUser: !!userData?.user,
            errorCode: eUser?.code,
            errorStatus: eUser?.status,
        });
        // Типизированный код ошибки + совместимое текстовое сообщение
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
    return { supabase, userId, bizId };
}

