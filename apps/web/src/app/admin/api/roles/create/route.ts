// apps/web/src/app/admin/api/roles/create/route.ts
import { NextResponse } from 'next/server';

import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { DATABASE_FAILURE_MESSAGES, publicErrorMessage, reportDatabaseError } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { withLocalizedMessages } from '@/lib/serverMessages';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { key: string; name: string; description?: string | null };

export const POST = withLocalizedMessages(async function POST(req: Request) {
    try {

        const supa = await createSupabaseServerClient();

        const { data: { user }, error: authError } = await supa.auth.getUser();
        if (authError || !user) return NextResponse.json({ ok:false, error:'auth' }, { status: 401 });

        const { isSuperAdmin: superRow, error: roleErr } = await checkCurrentUserIsSuperAdmin(supa, user.id);

        if (roleErr || !superRow) {
            return NextResponse.json({ ok:false, error:'forbidden' }, { status: 403 });
        }

        const body = (await req.json()) as Body;
        const key  = (body.key ?? '').trim();
        const name = (body.name ?? '').trim();
        const description = (body.description ?? null) || null;

        if (!/^[a-z0-9_-]{2,32}$/.test(key)) {
            return NextResponse.json({ ok:false, error:'Некорректный ключ роли' }, { status: 400 });
        }
        if (!name) {
            return NextResponse.json({ ok:false, error:'Название обязательно' }, { status: 400 });
        }

        // защитимся от «случайного» создания супер-админа как пользовательской роли
        const is_system = key === 'super_admin';

        const { data: row, error } = await supa
            .from('roles')
            .insert({ key, name, description, is_system })
            .select('id')
            .maybeSingle();

        if (error) return NextResponse.json({ ok:false, error: reportDatabaseError('AdminRoles', error, DATABASE_FAILURE_MESSAGES.save) }, { status: 400 });

        return NextResponse.json({ ok:true, id: row?.id });
    } catch (e: unknown) {
        logError('AdminRoles', 'Failed to create role', e);
        const msg = publicErrorMessage(e, DATABASE_FAILURE_MESSAGES.internal);
        return NextResponse.json({ ok:false, error: msg }, { status: 500 });
    }
});
