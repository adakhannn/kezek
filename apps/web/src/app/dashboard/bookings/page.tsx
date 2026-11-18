import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BookingsClientWrapper } from './BookingsClientWrapper';

import { getT } from '@/app/_components/i18n/server';
import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { getBizContextForManagers, BizAccessError } from '@/lib/authBiz'; // <-- твой рабочий хелпер
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page() {
    try {
        const { supabase, bizId, business } = await getBizContextForManagers();

        // 1) Данные для страницы (ВАЖНО: branch_id у services и staff)
        const [
            { data: services, error: servicesError },
            { data: staff, error: staffError },
            { data: branches, error: branchesError },
        ] = await Promise.all([
            supabase
                .from('services')
                .select('id,name_ru,name_ky,name_en,duration_min,active,branch_id')
                .eq('biz_id', bizId)
                .eq('active', true)
                .order('name_ru'),

            supabase
                .from('staff')
                .select('id,full_name,is_active,branch_id')
                .eq('biz_id', bizId)
                .eq('is_active', true)
                .order('full_name'),

            supabase
                .from('branches')
                .select('id,name,is_active')
                .eq('biz_id', bizId)
                .eq('is_active', true)
                .order('name'),
        ]);

        // FE-08: failed option lists are an error, not "no masters" / "no services".
        if (servicesError || staffError || branchesError) {
            logError('DashboardBookingsPage', 'Failed to load booking options', { bizId, servicesError, staffError, branchesError });
            return <LoadFailedNotice page />;
        }

        // Вкладка «Список» сама загружает страницы через dashboard_bookings_page (FE-03): прежняя
        // SSR-страница без фильтра (с отменёнными, без имён клиентов) только мелькала под «Загрузка...».

        return (
            <BookingsClientWrapper
                bizId={bizId}
                businessTz={business?.tz || null}
                services={services || []}
                staff={staff || []}
                branches={branches || []}
            />
        );
    } catch (e: unknown) {
        if (e instanceof BizAccessError) {
            if (e.code === 'NOT_AUTHENTICATED') {
                redirect('/auth/sign-in?redirect=/dashboard/bookings');
            }
            if (e.code === 'NO_BIZ_ACCESS') {
                const t = getT('ru');
                return (
                    <main className="p-6">
                        <h1 className="text-xl font-semibold mb-2">
                            {t('dashboard.bookings.noAccess.title', 'Нет доступа к кабинету')}
                        </h1>
                        <p className="text-sm text-gray-600 mb-4">
                            {t(
                                'dashboard.bookings.noAccess.description',
                                'У вашей учётной записи нет ролей owner / admin / manager ни в одном бизнесе.',
                            )}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/cabinet"
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                            >
                                {t('header.myBookings', 'Мои записи')}
                            </Link>
                            <Link
                                href="/staff"
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                            >
                                {t('header.staffCabinet', 'Кабинет сотрудника')}
                            </Link>
                        </div>
                    </main>
                );
            }
        } else if (e instanceof Error) {
            // Fallback по старым строковым сообщениям
            if (e.message === 'UNAUTHORIZED') {
                redirect('/auth/sign-in?redirect=/dashboard/bookings');
            }
            if (e.message === 'NO_BIZ_ACCESS') {
                const t = getT('ru');
                return (
                    <main className="p-6">
                        <h1 className="text-xl font-semibold mb-2">
                            {t('dashboard.bookings.noAccess.title', 'Нет доступа к кабинету')}
                        </h1>
                        <p className="text-sm text-gray-600 mb-4">
                            {t(
                                'dashboard.bookings.noAccess.description',
                                'У вашей учётной записи нет ролей owner / admin / manager ни в одном бизнесе.',
                            )}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/cabinet"
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                            >
                                {t('header.myBookings', 'Мои записи')}
                            </Link>
                            <Link
                                href="/staff"
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                            >
                                {t('header.staffCabinet', 'Кабинет сотрудника')}
                            </Link>
                        </div>
                    </main>
                );
            }
        }
        // Другие ошибки
        const t = getT('ru');
        return (
            <main className="p-6">
                <h1 className="text-xl font-semibold mb-2 text-red-600">
                    {t('dashboard.bookings.error.title', 'Ошибка')}
                </h1>
                <p className="text-sm text-gray-600">
                    {t(
                        'dashboard.bookings.error.description',
                        'Произошла ошибка при загрузке броней. Пожалуйста, попробуйте обновить страницу.'
                    )}
                </p>
                {e instanceof Error && (
                    <p className="text-xs text-gray-500 mt-2">
                        {t('dashboard.bookings.error.details', 'Детали')}: {e.message}
                    </p>
                )}
            </main>
        );
    }
}
