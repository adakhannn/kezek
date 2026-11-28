// apps/web/src/app/admin/api/roles/list/route.ts
import {NextResponse} from 'next/server';

import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { DATABASE_FAILURE_MESSAGES, publicErrorMessage, reportDatabaseError } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {

        const supa = await createSupabaseServerClient();

        const { data: { user }, error: authError } = await supa.auth.getUser();
        if (authError || !user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const { isSuperAdmin: superRow, error: roleErr } = await checkCurrentUserIsSuperAdmin(supa, user.id);

        if (roleErr || !superRow) {
            return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});
        }

        const {data: items, error} = await supa
            .from('roles')
            .select('*')
            .order('is_system', {ascending: false})
            .order('key', {ascending: true});

        if (error) return NextResponse.json({ok: false, error: reportDatabaseError('AdminRoles', error, DATABASE_FAILURE_MESSAGES.load)}, {status: 400});

        return NextResponse.json({ok: true, items});
    } catch (e: unknown) {
        logError('AdminRoles', 'Failed to list roles', e);
        const msg = publicErrorMessage(e, DATABASE_FAILURE_MESSAGES.internal);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

// поддержим POST для удобства (если ты дергал list POST'ом)
export const POST = GET;
