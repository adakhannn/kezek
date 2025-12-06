import type { SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type FilterValue = string | number | boolean | null;

async function count(
    supabase: SupabaseClient,
    table: string,
    filters: { col: string; eq?: FilterValue; gte?: FilterValue; lte?: FilterValue }[] = []
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

    const [bookingsToday, staffActive, servicesActive, branchesCount] = await Promise.all([
        count(supabase, 'bookings', [{ col: 'biz_id', eq: bizId }, { col: 'start_at', gte: start }, { col: 'start_at', lte: end }]),
        count(supabase, 'staff', [{ col: 'biz_id', eq: bizId }, { col: 'is_active', eq: true }]),
        count(supabase, 'services', [{ col: 'biz_id', eq: bizId }, { col: 'active', eq: true }]),
        count(supabase, 'branches', [{ col: 'biz_id', eq: bizId }, { col: 'is_active', eq: true }]),
    ]);

    return (
        <main className="mx-auto max-w-6xl space-y-8">
            <div>
                <h1 className="text-2xl font-semibold">Кабинет</h1>
                <p className="text-sm text-gray-500">Коротко о состоянии на сегодня.</p>
            </div>

            {/* KPI блоки */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="border rounded-lg p-4">
                    <div className="text-sm text-gray-500">Брони сегодня</div>
                    <div className="text-3xl font-semibold mt-1">{bookingsToday}</div>
                    <Link href="/dashboard/bookings" className="text-sm mt-3 inline-block underline underline-offset-2">
                        Открыть календарь
                    </Link>
                </div>

                <div className="border rounded-lg p-4">
                    <div className="text-sm text-gray-500">Активных сотрудников</div>
                    <div className="text-3xl font-semibold mt-1">{staffActive}</div>
                    <Link href="/dashboard/staff" className="text-sm mt-3 inline-block underline underline-offset-2">
                        Управлять сотрудниками
                    </Link>
                </div>

                <div className="border rounded-lg p-4">
                    <div className="text-sm text-gray-500">Активных услуг</div>
                    <div className="text-3xl font-semibold mt-1">{servicesActive}</div>
                    <Link href="/dashboard/services" className="text-sm mt-3 inline-block underline underline-offset-2">
                        Перейти к услугам
                    </Link>
                </div>

                <div className="border rounded-lg p-4">
                    <div className="text-sm text-gray-500">Филиалов</div>
                    <div className="text-3xl font-semibold mt-1">{branchesCount}</div>
                    <Link href="/dashboard/branches" className="text-sm mt-3 inline-block underline underline-offset-2">
                        Список филиалов
                    </Link>
                </div>
            </section>

            {/* Быстрые действия */}
            <section className="border rounded-lg p-4">
                <h2 className="font-medium mb-3">Быстрые действия</h2>
                <div className="flex flex-wrap gap-2">
                    <Link href="/dashboard/bookings" className="border rounded px-3 py-2">Открыть «Календарь»</Link>
                    <Link href="/dashboard/staff/new" className="border rounded px-3 py-2">Добавить сотрудника</Link>
                    <Link href="/dashboard/services/new" className="border rounded px-3 py-2">Добавить услугу</Link>
                    <Link href="/dashboard/staff" className="border rounded px-3 py-2">Назначить услуги мастеру</Link>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Навигация слева доступна на всех страницах кабинета.
                </p>
            </section>
        </main>
    );
}
