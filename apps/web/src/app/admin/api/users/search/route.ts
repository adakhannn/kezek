export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { DATABASE_FAILURE_MESSAGES, publicErrorMessage, reportDatabaseError } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

/** простая защита от вредного запроса */
function normQ(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

export async function GET(req: Request) {
    try {
        const supa = await createSupabaseServerClient();

        // доступ: только супер-админам
        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok:false, error:'auth' }, { status:401 });
        
        const { data: isSuper, error: superErr } = await supa.rpc('is_super_admin');
        if (superErr) return NextResponse.json({ ok:false, error: reportDatabaseError('AdminUsersSearch', superErr) }, { status:400 });
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
        if (error) return NextResponse.json({ ok:false, error: reportDatabaseError('AdminUsersSearch', error, DATABASE_FAILURE_MESSAGES.load) }, { status:400 });

        return NextResponse.json({ ok:true, items: data ?? [] });
    } catch (e: unknown) {
        logError('AdminUsersSearch', 'User search failed', e);
        const msg = publicErrorMessage(e, DATABASE_FAILURE_MESSAGES.internal);
        return NextResponse.json({ ok:false, error: msg }, { status:500 });
    }
}
