export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import {getBizContextForManagers} from '@/lib/authBiz';

export async function POST(_: Request, ctx: unknown) {
    try {
        const params =
            typeof ctx === 'object' && ctx && 'params' in ctx
                ? (ctx as { params: Record<string, string> }).params
                : {};
        const branchId = params.id;

        const {supabase} = await getBizContextForManagers(); // проверка доступа уже внутри
        const {data, error} = await supabase.rpc('branch_admins_effective', {p_branch_id: branchId});
        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        // Подтянем e-mail/phone/full_name (через твою вьюху auth_users_view и profiles)
        const userIds: string[] = Array.from(new Set((data ?? []).map((x: { user_id: number }) => x.user_id)));
        let metaMap = new Map<string, { email: string | null; phone: string | null; full_name: string | null }>();
        if (userIds.length) {
            const {data: users} = await supabase
                .from('auth_users_view')
                .select('id,email,phone,full_name')
                .in('id', userIds);
            metaMap = new Map(
                (users ?? []).map((u) => [
                    u.id,
                    {email: u.email ?? null, phone: u.phone ?? null, full_name: u.full_name ?? null},
                ])
            );
        }

        const items = (data ?? []).map((row: { user_id: string; source: string; }) => ({
            user_id: row.user_id as string,
            source: row.source as 'owner' | 'biz_admin' | 'branch_admin',
            ...(metaMap.get(row.user_id) ?? {email: null, phone: null, full_name: null}),
        }));

        return NextResponse.json({ok: true, items});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
