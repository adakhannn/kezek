// apps/web/src/app/admin/api/businesses/[id]/members/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import { logError } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { isUuid } from '@/lib/validation';

type Item = {
    user_id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
    roles: string[]; // на клиенте скастится к RoleKey[]
};

type MemberRow = {
    user_id: unknown;
    email?: string | null;
    phone?: string | null;
    full_name?: string | null;
    roles?: unknown;
};

export async function GET(_req: Request, context: unknown) {
    try {
        const id = await getRouteParamRequired(context, 'id');

        if (!isUuid(id)) {
            return NextResponse.json({ok: false, error: 'bad biz_id'}, {status: 400});
        }

        const supa = await createSupabaseServerClient();
        const { data: { user }, error: authError } = await supa.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
        }

        // members_of_biz сам проверяет права: супер-админ, владелец или админ этого бизнеса.
        // Запасного чтения из user_roles_with_user нет: представление отдаёт сессии только её строки.
        const {data: rpcData, error: rpcErr} = await supa.rpc('members_of_biz', {p_biz_id: id});
        if (rpcErr) {
            const forbidden = /P0001|forbidden|denied/i.test(`${rpcErr.code ?? ''} ${rpcErr.message ?? ''}`);
            if (!forbidden) logError('AdminMembersList', 'members_of_biz failed', rpcErr);
            return NextResponse.json(
                { ok: false, error: forbidden ? 'forbidden' : 'members_unavailable' },
                { status: forbidden ? 403 : 500 },
            );
        }

        const items: Item[] = (Array.isArray(rpcData) ? (rpcData as MemberRow[]) : []).map((r) => ({
            user_id: String(r.user_id),
            email: r.email ?? null,
            phone: r.phone ?? null,
            full_name: r.full_name ?? null,
            roles: Array.isArray(r.roles) ? r.roles.map(String) : [],
        }));
        return NextResponse.json({ok: true, items});
    } catch (e: unknown) {
        logError('AdminMembersList', 'Unexpected members list failure', e);
        return NextResponse.json({ok: false, error: 'members_unavailable'}, {status: 500});
    }
}
