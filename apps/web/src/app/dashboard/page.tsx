import { DashboardHomeClient } from './components/DashboardHomeClient';

import { getBizContextForManagers } from '@/lib/authBiz';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function count(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    table: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filters: { col: string; eq?: any; gte?: any; lte?: any }[] = []
): Promise<number> {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    for (const f of filters) {
        if (f.eq !== undefined) q = q.eq(f.col, f.eq);
        if (f.gte !== undefined) q = q.gte(f.col, f.gte);
        if (f.lte !== undefined) q = q.lte(f.col, f.lte);
    }
    const { count: c } = await q;
    return c ?? 0;
}

export default async function DashboardHome() {
    const { supabase, bizId } = await getBizContextForManagers();

    // диапазон «сегодня» в TZ бизнеса можно будет брать из businesses.tz.
    // Пока используем локальный день (UTC+06 можно подставить при желании).
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, '0');
    const d = String(today.getUTCDate()).padStart(2, '0');
    const start = `${y}-${m}-${d}T00:00:00Z`;
    const end   = `${y}-${m}-${d}T23:59:59Z`;

    const [[bookingsToday, staffActive, servicesActive, branchesCount], { data: biz }] = await Promise.all([
        Promise.all([
            count(supabase, 'bookings', [{ col: 'biz_id', eq: bizId }, { col: 'start_at', gte: start }, { col: 'start_at', lte: end }]),
            count(supabase, 'staff', [{ col: 'biz_id', eq: bizId }, { col: 'is_active', eq: true }]),
            count(supabase, 'services', [{ col: 'biz_id', eq: bizId }, { col: 'active', eq: true }]),
            count(supabase, 'branches', [{ col: 'biz_id', eq: bizId }, { col: 'is_active', eq: true }]),
        ]),
        supabase
            .from('businesses')
            .select('name, city, slug')
            .eq('id', bizId)
            .maybeSingle<{ name: string | null; city: string | null; slug: string | null }>(),
    ]);

    const bizName = biz?.name || null; // Передаем null, чтобы перевести на клиенте
    const bizCity = biz?.city || null;

    // Передаем ISO строку, форматирование будет на клиенте с учетом локали
    const formattedDate = today.toISOString();

    const needOnboarding =
        bookingsToday === 0 || staffActive === 0 || servicesActive === 0 || branchesCount === 0;

    return (
        <DashboardHomeClient
            bizName={bizName}
            bizCity={bizCity}
            formattedDate={formattedDate}
            bookingsToday={bookingsToday}
            staffActive={staffActive}
            servicesActive={servicesActive}
            branchesCount={branchesCount}
            needOnboarding={needOnboarding}
        />
    );
}
