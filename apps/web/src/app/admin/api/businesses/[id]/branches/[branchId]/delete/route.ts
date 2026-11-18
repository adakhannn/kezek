// apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/delete/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import { runBranchDelete } from '@/lib/branchDeleteService';
import { logError } from '@/lib/log';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

// Аккуратно парсим id и branchId из URL, без any
function extractIds(urlStr: string): { id: string; branchId: string } {
    const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
    // .../admin/api/businesses/{id}/branches/{branchId}/delete
    const iBiz = parts.findIndex(p => p === 'businesses');
    const iBranches = parts.findIndex((p, i) => i > iBiz && p === 'branches');
    const id = iBiz >= 0 ? parts[iBiz + 1] ?? '' : '';
    const branchId = iBranches >= 0 ? parts[iBranches + 1] ?? '' : '';
    return {id, branchId};
}

/**
 * Super-admin branch delete. The same single database command as /api/branches/[id]/delete
 * (DB-14, ARCH-08): only a branch without history is deleted, in one transaction.
 */
export async function POST(req: Request) {
    try {
        const {id, branchId} = extractIds(req.url);

        const supa = await createSupabaseServerClient();

        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        const result = await runBranchDelete({ admin: createSupabaseAdminClient(), branchId, bizId: id });
        if (!result.ok) {
            return NextResponse.json({ ok: false, code: result.errorType, error: result.message, details: result.details }, { status: result.statusCode });
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        logError('BranchDelete', 'Failed to delete branch', e);
        return NextResponse.json({ ok: false, error: 'Не удалось удалить филиал' }, { status: 500 });
    }
}

// поддержим HTTP DELETE
export const DELETE = POST;
