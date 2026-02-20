import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { getT } from '@/app/_components/i18n/server';
import Client from '@/app/dashboard/staff/[id]/slots/Client';
import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffSlotsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { supabase, bizId } = await getBizContextForManagers();

    // 1) сотрудник
    const { data: staff } = await supabase
        .from('staff')
        .select('id, full_name, is_active, biz_id')
        .eq('id', id)
        .maybeSingle();

    if (!staff || String(staff.biz_id) !== String(bizId)) {
        const t = getT('ru');
        return (
            <main className="p-6 text-red-600">
                {t('staff.slots.notFound', 'Сотрудник не найден или нет доступа')}
            </main>
        );
    }

    // 2) активные филиалы бизнеса
    const { data: branches } = await supabase
        .from('branches')
        .select('id, name, is_active')
        .eq('biz_id', bizId)
        .eq('is_active', true)
        .order('name');

    // 3) услуги, которые этот мастер реально оказывает:
    // services INNER JOIN service_staff (service_staff.is_active = true, service_staff.staff_id = staff.id)
    // + услуга активна и принадлежит этому бизнесу
    const { data: svcJoin, error: svcErr } = await supabase
        .from('services')
        .select(
            `
        id,
        name_ru,
        duration_min,
        branch_id,
        active,
        service_staff!inner (
          staff_id,
          is_active
        )
      `
        )
        .eq('biz_id', bizId)
        .eq('active', true)
        .eq('service_staff.staff_id', staff.id)
        .eq('service_staff.is_active', true)
        .order('name_ru');

    if (svcErr) {
        const t = getT('ru');
        return (
            <main className="p-6 text-red-600">
                {t('staff.slots.error.loadServices', 'Ошибка загрузки услуг')}: {svcErr.message}
            </main>
        );
    }

    // нормализуем под Client
    const services =
        (svcJoin ?? []).map((s) => ({
            id: String(s.id),
            name: String(s.name_ru),
            duration_min: Number(s.duration_min),
            branch_id: String(s.branch_id),
        })) || [];

    const today = formatInTimeZone(new Date(), 'Asia/Bishkek', 'yyyy-MM-dd');

    const SlotsPageContent = () => {
        const { t } = useLanguage();

        return (
            <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
                {/* Заголовок */}
                <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white shadow-lg">
                    <div className="px-6 py-6 lg:px-8 lg:py-7">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <Link
                                        href={`/dashboard/staff/${staff.id}`}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                        title={t('staff.detail.back.title', 'Вернуться к списку сотрудников')}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                    </Link>
                                    <div>
                                        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
                                            {t('staff.detail.nav.slots', 'Свободные слоты')}
                                        </h1>
                                        <p className="text-sm lg:text-base text-indigo-100/90 mt-1">{staff.full_name}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {services.length === 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3">
                        <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                    {t('staff.services.empty.title', 'Этому сотруднику пока не назначены услуги')}
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                    {t(
                                        'staff.services.empty.desc',
                                        'Назначьте услуги на странице сотрудника (раздел «Компетенции»), чтобы видеть свободные слоты.',
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <Client
                    bizId={bizId}
                    staffId={staff.id}
                    services={services}
                    branches={(branches ?? []).map((b) => ({ id: String(b.id), name: String(b.name) }))}
                    defaultDate={today}
                />
            </main>
        );
    };

    return <SlotsPageContent />;
}
