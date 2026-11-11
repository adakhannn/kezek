import type { SupabaseClient } from '@supabase/supabase-js';

import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import {
    initializeRatings,
    type InitializeRatingsAdminLike,
    type InitializeRatingsPayload,
} from '@/lib/initializeRatingsService';

type Failure = {
    ok: false;
    status: 400 | 401 | 403;
    error: 'auth' | 'forbidden' | 'internal' | 'validation';
    message: string;
};

type Success = {
    ok: true;
    payload: {
        message: string;
    };
};

export type InitializeRatingsRouteResult = Failure | Success;

export async function runInitializeRatingsRoute({
    supabase,
    admin,
    body,
}: {
    supabase: Pick<SupabaseClient, 'auth' | 'rpc'>;
    admin: InitializeRatingsAdminLike;
    body: InitializeRatingsPayload;
}): Promise<InitializeRatingsRouteResult> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return {
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Не авторизован',
        };
    }

    const { isSuperAdmin: superRow, error: superErr } = await checkCurrentUserIsSuperAdmin(supabase, user.id);

    if (superErr) {
        return {
            ok: false,
            status: 400,
            error: 'internal',
            message: superErr.message,
        };
    }

    if (!superRow) {
        return {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Доступ запрещен',
        };
    }

    const result = await initializeRatings(admin, body);
    if (!result.ok) {
        return {
            ok: false,
            status: result.status as 400,
            error: result.error as 'internal' | 'validation',
            message: result.message,
        };
    }

    return {
        ok: true,
        payload: result.data,
    };
}
