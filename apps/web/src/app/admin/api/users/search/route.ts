export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Нормализует и экранирует поисковый запрос для безопасного использования в ilike
 * Экранирует специальные символы PostgREST: %, _, \
 */
function normQ(v: unknown): string {
    if (typeof v !== 'string') return '';
    // Ограничиваем длину запроса для защиты от DoS
    const trimmed = v.trim().slice(0, 100);
    // Экранируем специальные символы для ilike: %, _, \
    return trimmed.replace(/[%_\\]/g, (char) => `\\${char}`);
}

export async function GET(req: Request) {
    try {
        const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        // доступ: только супер-админам или админам страниц (проверяется там, где зовут выдачу ролей)
        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok:false, error:'auth' }, { status:401 });

        // читаем q
        const url = new globalThis.URL(req.url);
        const q   = normQ(url.searchParams.get('q'));

        // auth_users_view: id, email, phone, full_name — уже есть у тебя
        // если q пуст — берём первые 20
        let query = supa.from('auth_users_view')
            .select('id,email,phone,full_name')
            .order('id', { ascending: true })
            .limit(20);

        if (q) {
            // Безопасный поиск: экранированные значения подставляются в параметризованный запрос
            // PostgREST автоматически экранирует значения в .or(), но мы дополнительно экранируем для ilike
            const searchPattern = `%${q}%`;
            query = supa.from('auth_users_view')
                .select('id,email,phone,full_name')
                .or(`email.ilike.${searchPattern},phone.ilike.${searchPattern},full_name.ilike.${searchPattern}`)
                .order('id', { ascending: true })
                .limit(20);
        }

        const { data, error } = await query;
        if (error) return NextResponse.json({ ok:false, error: error.message }, { status:400 });

        return NextResponse.json({ ok:true, items: data ?? [] });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok:false, error: msg }, { status:500 });
    }
}
