import { NextResponse } from 'next/server';

import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
};

export async function POST(req: Request, ctx: unknown) {
    try {
        const params =
            typeof ctx === 'object' && ctx !== null && 'params' in ctx
                ? await (ctx as { params: Promise<Record<string, string>> | Record<string, string> }).params
                : {};
        const userId = params.id;
        if (!userId) {
            return NextResponse.json({ ok: false, error: 'missing user id' }, { status: 400 });
        }

        const body = (await req.json()) as Body;
        const full_name = (body.full_name ?? '').trim();
        const email = body.email?.trim() || null;
        const phone = body.phone?.trim() || null;

        // 1) Проверка авторизации и что вызывающий — global super_admin
        const supa = await createSupabaseServerClient();

        const { data: { user }, error: authError } = await supa.auth.getUser();
        if (authError || !user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        const { isSuperAdmin: superRow, error: superErr } = await checkCurrentUserIsSuperAdmin(supa, user.id);
        if (superErr) return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        if (!superRow) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        // 2) Обновляем auth.users через service role
        const admin = createSupabaseAdminClient();

        // Сначала читаем текущие метаданные, чтобы не потерять другие поля
        const { data: got, error: getErr } = await admin.auth.admin.getUserById(userId);
        if (getErr || !got?.user) {
            return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
        }
        const prevMeta = (got.user.user_metadata ?? {}) as Record<string, unknown>;

        const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
            email: email ?? undefined,           // не передаём поле, если null
            phone: phone ?? undefined,
            user_metadata: { ...prevMeta, full_name: full_name || null },
        });

        if (updErr) {
            return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export const PUT = POST;
