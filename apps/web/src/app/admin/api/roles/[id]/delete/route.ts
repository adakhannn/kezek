// apps/web/src/app/admin/api/roles/[id]/delete/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
    try {
        const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok:false, error:'auth' }, { status: 401 });

        const { data: superRow, error: roleErr } = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (roleErr || !superRow) {
            return NextResponse.json({ ok:false, error:'forbidden' }, { status: 403 });
        }

        // запретим удаление системных ролей
        const { data: roleRow, error: roleGetErr } = await supa
            .from('roles')
            .select('is_system')
            .eq('id', params.id)
            .maybeSingle();

        if (roleGetErr) return NextResponse.json({ ok:false, error: roleGetErr.message }, { status: 400 });
        if (!roleRow)   return NextResponse.json({ ok:false, error: 'not found' }, { status: 404 });
        if (roleRow.is_system) {
            return NextResponse.json({ ok:false, error:'Системную роль удалять нельзя' }, { status: 400 });
        }

        const { error } = await supa
            .from('roles')
            .delete()
            .eq('id', params.id);

        if (error) {
            // возможная ссылка в user_roles (FK 23503)
            const friendly = /23503/.test((error).code ?? '') || /foreign key/i.test(error.message)
                ? 'Нельзя удалить: роль используется. Сначала уберите её из user_roles.'
                : error.message;
            return NextResponse.json({ ok:false, error: friendly }, { status: 400 });
        }

        return NextResponse.json({ ok:true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok:false, error: msg }, { status: 500 });
    }
}

// на всякий — поддержим DELETE:
export const DELETE = POST;
