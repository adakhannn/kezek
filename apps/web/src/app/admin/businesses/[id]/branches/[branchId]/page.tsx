// apps/web/src/app/admin/businesses/[id]/branches/[branchId]/page.tsx
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { BranchForm } from '@/components/admin/branches/BranchForm';
import { BranchScheduleEditor } from '@/components/admin/branches/BranchScheduleEditor';
import { Card } from '@/components/ui/Card';
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey } from '@/lib/env';

export const dynamic = 'force-dynamic';

type RouteParams = { id: string; branchId: string };

export default async function BranchEditPage({ params }: { params: Promise<RouteParams> }) {
    const { id, branchId } = await params;

    const URL = getSupabaseUrl();
    const ANON = getSupabaseAnonKey();
    const SERVICE = getSupabaseServiceRoleKey();
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;
    const { data: isSuper } = await supa.rpc('is_super_admin');
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    const admin = createClient(URL, SERVICE);
    const { data: branch, error } = await admin
        .from('branches')
        .select('id,biz_id,name,address,is_active,lat,lon')
        .eq('biz_id', id)
        .eq('id', branchId)
        .maybeSingle();

    if (error) return <div className="p-4">Ошибка: {error.message}</div>;
    if (!branch) return <div className="p-4">Филиал не найден</div>;

    const { data: biz } = await admin.from('businesses').select('id,name').eq('id', id).maybeSingle();

    // Загружаем расписание филиала
    const { data: scheduleData } = await admin
        .from('branch_working_hours')
        .select('day_of_week, intervals, breaks')
        .eq('biz_id', id)
        .eq('branch_id', branchId)
        .order('day_of_week');

    const initialSchedule = (scheduleData || []).map((s) => ({
        day_of_week: s.day_of_week,
        intervals: (s.intervals || []) as Array<{ start: string; end: string }>,
        breaks: (s.breaks || []) as Array<{ start: string; end: string }>,
    }));

    return (
        <div className="space-y-6">
            {/* Заголовок */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent mb-2">
                            Редактировать филиал
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {branch.name} • {biz?.name}
                        </p>
                    </div>
                    <Link
                        href={`/admin/businesses/${id}/branches`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        К списку филиалов
                    </Link>
                </div>
            </div>

            {/* Форма */}
            <Card className="p-6">
                <BranchForm
                    mode="edit"
                    bizId={branch.biz_id}
                    branchId={branch.id}
                    initial={{
                        name: branch.name,
                        address: branch.address ?? '',
                        is_active: !!branch.is_active,
                        lat: branch.lat ?? null,
                        lon: branch.lon ?? null,
                    }}
                />
            </Card>

            {/* Расписание */}
            <Card className="p-6">
                <BranchScheduleEditor bizId={branch.biz_id} branchId={branch.id} initialSchedule={initialSchedule} />
            </Card>
        </div>
    );
}
