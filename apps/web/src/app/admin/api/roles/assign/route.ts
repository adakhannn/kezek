// POST JSON: { user_id: string, biz_id?: string|null, role: string }
import {NextResponse} from "next/server";

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function POST(req: Request) {
    const supa = await createSupabaseServerClient();

    const {data: {user}} = await supa.auth.getUser();
    if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

    const {user_id, biz_id, role} = await req.json();
    const {error} = await supa.rpc('grant_role_rpc', {
        p_user: user_id, p_biz: biz_id ?? null, p_role: role
    });
    if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
    return NextResponse.json({ok: true});
}
