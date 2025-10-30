export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Body = {
    user_id?: string | null;
};

export async function POST(req: Request, ctx: unknown) {
    try {
        const bizId =
            typeof ctx === 'object' &&
            ctx !== null &&
            'params' in ctx &&
            (ctx as { params: Record<string, string> }).params.id
                ? (ctx as { params: Record<string, string> }).params.id
                : null;

        if (!bizId) {
            return NextResponse.json({ ok: false, error: 'missing business id' }, { status: 400 });
        }

        const raw = (await req.json()) as Body;
        const userId = raw.user_id?.trim() || null;

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // Кто вызывает — должен быть супер
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {},
            },
        });

        const { data: { user } } = await supa.auth.getUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
        }

        const { data: superRow, error: superErr } = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (superErr) return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        if (!superRow) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        // Сервис-клиент
        const admin = createClient(URL, SERVICE);

        // Снять владельца
        if (!userId) {
            const { error: clearErr } = await admin.rpc('clear_business_owner', { p_biz_id: bizId });
            if (clearErr) {
                return NextResponse.json({ ok: false, error: clearErr.message }, { status: 400 });
            }
            return NextResponse.json({ ok: true, cleared: true });
        }

        // Проверка, что пользователь существует
        const { data: targetUser, error: getUserErr } = await admin.auth.admin.getUserById(userId);
        if (getUserErr || !targetUser?.user) {
            return NextResponse.json({ ok: false, error: 'Пользователь не найден в системе' }, { status: 404 });
        }

        // Назначение владельца (ошибки маппим)
        const { error: setErr } = await admin.rpc('assign_business_owner', {
            p_biz_id: bizId,
            p_user_id: userId,
        });

        if (setErr) {
            const m = setErr.message || '';
            if (/USER_SUSPENDED/i.test(m)) {
                return NextResponse.json(
                    { ok: false, error: 'Этот пользователь заблокирован и не может быть назначен владельцем.', code: 'USER_SUSPENDED' },
                    { status: 400 }
                );
            }
            if (/USER_ALREADY_OWNER_OF_OTHER_BIZ/i.test(m)) {
                return NextResponse.json(
                    { ok: false, error: 'Пользователь уже владеет другим бизнесом. Создайте отдельный аккаунт.', code: 'USER_ALREADY_OWNER_OF_OTHER_BIZ' },
                    { status: 400 }
                );
            }
            return NextResponse.json({ ok: false, error: setErr.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export const PUT = POST;
