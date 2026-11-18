// apps/web/src/app/admin/api/businesses/[id]/delete/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import { runBusinessDelete } from '@/lib/businessDeleteService';
import { logError } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

/** Super-admin delete of a business without history (DB-14); a business with history is unapproved instead. */
export async function POST(_req: Request, context: unknown) {
    try {
        const bizId = await getRouteParamRequired(context, 'id');

        // проверяем, что вызывает супер-админ
        const supa = await createSupabaseServerClient();
        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        const result = await runBusinessDelete({ admin: createSupabaseAdminClient(), bizId });
        if (!result.ok) {
            return NextResponse.json({ ok: false, code: result.error, error: result.message }, { status: result.status });
        }

        return NextResponse.json({ok: true});
    } catch (e) {
        logError('BusinessDelete', 'Failed to delete business', e);
        return NextResponse.json({ ok: false, error: 'Не удалось удалить бизнес' }, { status: 500 });
    }
}
