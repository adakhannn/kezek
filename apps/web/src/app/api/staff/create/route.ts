export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import {getBizContextForManagers} from '@/lib/authBiz';

type Body = {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    branch_id: string;
    is_active: boolean;
};

export async function POST(req: Request) {
    try {
        const {supabase, userId, bizId} = await getBizContextForManagers();

        // проверка роли в этом бизнесе
        const {data: roles} = await supabase
            .from('user_roles')
            .select('roles!inner(key)')
            .eq('user_id', userId)
            .eq('biz_id', bizId);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ok = (roles ?? []).some(r => (r as any).roles?.key && ['owner', 'admin', 'manager'].includes((r as any).roles.key));
        if (!ok) return NextResponse.json({ok: false, error: 'FORBIDDEN'}, {status: 403});

        const body = (await req.json()) as Body;
        if (!body.full_name || !body.branch_id) {
            return NextResponse.json({ok: false, error: 'INVALID_BODY'}, {status: 400});
        }

        const {data, error} = await supabase
            .from('staff')
            .insert({
                biz_id: bizId,
                branch_id: body.branch_id,
                full_name: body.full_name,
                email: body.email ?? null,
                phone: body.phone ?? null,
                is_active: !!body.is_active,
            })
            .select('id')
            .single();

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        return NextResponse.json({ok: true, id: data?.id});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return NextResponse.json({ok: false, error: e?.message ?? 'UNKNOWN'}, {status: 500});
    }
}
