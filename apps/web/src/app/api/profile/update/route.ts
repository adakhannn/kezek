export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Body = {
    full_name?: string | null;
    phone?: string | null;
    notify_email?: boolean;
    notify_sms?: boolean;
    notify_whatsapp?: boolean;
    notify_telegram?: boolean;
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
        const notify_email = body.notify_email ?? true;
        const notify_sms = body.notify_sms ?? true;
        const notify_whatsapp = body.notify_whatsapp ?? true;
        const notify_telegram = body.notify_telegram ?? true;

        // Получаем текущий профиль, чтобы проверить, изменился ли номер телефона
        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('phone, whatsapp_verified')
            .eq('id', user.id)
            .maybeSingle<{ phone: string | null; whatsapp_verified: boolean | null }>();

        // Если номер телефона был удален или изменен, сбрасываем whatsapp_verified
        const phoneChanged = currentProfile?.phone !== phone;
        const whatsapp_verified = phoneChanged || !phone ? false : (currentProfile?.whatsapp_verified ?? false);

        // Берём telegram_id из user_metadata, если он есть
        const meta = (user.user_metadata ?? {}) as { telegram_id?: number | string | null };
        const upsertData: Record<string, unknown> = {
            id: user.id,
            full_name,
            phone,
            notify_email,
            notify_sms,
            notify_whatsapp,
            whatsapp_verified,
            notify_telegram,
        };

        if (meta.telegram_id != null) {
            const tid = typeof meta.telegram_id === 'string' ? Number(meta.telegram_id) : meta.telegram_id;
            if (!Number.isNaN(tid)) {
                upsertData.telegram_id = tid;
                upsertData.telegram_verified = true;
            }
        }

        // Обновляем профиль в таблице profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert(upsertData, { onConflict: 'id' });

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

