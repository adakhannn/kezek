export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/** простая защита от вредного запроса */
function normQ(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

export async function GET(req: Request) {
    try {
        const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        // доступ: только супер-админам
        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok:false, error:'auth' }, { status:401 });
        
        const { data: isSuper, error: superErr } = await supa.rpc('is_super_admin');
        if (superErr) return NextResponse.json({ ok:false, error: superErr.message }, { status:400 });
        if (!isSuper) return NextResponse.json({ ok:false, error:'forbidden' }, { status:403 });

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
            // простой OR по полям
            query = supa.from('auth_users_view')
                .select('id,email,phone,full_name')
                .or(`email.ilike.%${q}%,phone.ilike.%${q}%,full_name.ilike.%${q}%`)
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
