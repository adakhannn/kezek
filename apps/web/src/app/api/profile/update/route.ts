export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Body = {
    full_name?: string | null;
    phone?: string | null;
};

export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();

        // Проверка авторизации
        const supabase = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value,
                set: () => {},
                remove: () => {},
            },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'auth', message: 'Не авторизован' }, { status: 401 });
        }

        const body = (await req.json()) as Body;
        const full_name = body.full_name?.trim() || null;
        const phone = body.phone?.trim() || null;

        // Обновляем профиль в таблице profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert(
                {
                    id: user.id,
                    full_name: full_name,
                    phone: phone,
                },
                { onConflict: 'id' }
            );

        if (profileError) {
            console.error('[profile/update] profile error:', profileError);
            return NextResponse.json(
                { ok: false, error: 'profile_update_failed', message: profileError.message },
                { status: 400 }
            );
        }

        // Также обновляем user_metadata для совместимости
        const prevMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const { error: metaError } = await supabase.auth.updateUser({
            data: { ...prevMeta, full_name: full_name || null },
        });

        if (metaError) {
            console.error('[profile/update] metadata error:', metaError);
            // Не критично, продолжаем
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[profile/update] error:', e);
        return NextResponse.json({ ok: false, error: 'internal', message: msg }, { status: 500 });
    }
}

