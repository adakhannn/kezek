import { redirect } from 'next/navigation';

import { BookingsClientWrapper } from './BookingsClientWrapper';

import { getT } from '@/app/_components/i18n/server';
import { getBizContextForManagers, BizAccessError } from '@/lib/authBiz'; // <-- твой рабочий хелпер

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page() {
    try {
        const { supabase, bizId } = await getBizContextForManagers();

        // 1) Данные для страницы (ВАЖНО: branch_id у services и staff)
        const [{ data: services }, { data: staff }, { data: branches }, { data: biz }] = await Promise.all([
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
            supabase
                .from('businesses')
                .select('tz')
                .eq('id', bizId)
                .maybeSingle<{ tz: string | null }>(),
        ]);

        // 2) Последние брони (для вкладки «Список») - загружаем только первую страницу
        // Клиентский компонент сам реализует пагинацию и загружает данные по мере необходимости
        const { data: bookings } = await supabase
            .from('bookings')
            .select('id,status,start_at,end_at,services(name_ru,name_ky),staff(full_name)')
            .eq('biz_id', bizId)
            .order('start_at', { ascending: false })
            .limit(30); // Начальная загрузка для SSR, клиентский компонент загрузит остальное

        return (
            <BookingsClientWrapper
                bizId={bizId}
                businessTz={biz?.tz || null}
                services={services || []}
                staff={staff || []}
                branches={branches || []}
                initial={bookings || []}
            />
        );
    } catch (e: unknown) {
        if (e instanceof BizAccessError) {
            if (e.code === 'NOT_AUTHENTICATED') {
                redirect('/b/kezek');
            }
            if (e.code === 'NO_BIZ_ACCESS') {
                const t = getT('ru');
                return (
                    <main className="p-6">
                        <h1 className="text-xl font-semibold mb-2">
                            {t('dashboard.bookings.noAccess.title', 'Нет доступа к кабинету')}
                        </h1>
                        <p className="text-sm text-gray-600">
                            {t(
                                'dashboard.bookings.noAccess.description',
                                'У вашей учётной записи нет ролей owner / admin / manager ни в одном бизнесе.',
                            )}
                        </p>
                    </main>
                );
            }
        } else if (e instanceof Error) {
            // Fallback по старым строковым сообщениям
            if (e.message === 'UNAUTHORIZED') {
                redirect('/b/kezek');
            }
            if (e.message === 'NO_BIZ_ACCESS') {
                const t = getT('ru');
                return (
                    <main className="p-6">
                        <h1 className="text-xl font-semibold mb-2">
                            {t('dashboard.bookings.noAccess.title', 'Нет доступа к кабинету')}
                        </h1>
                        <p className="text-sm text-gray-600">
                            {t(
                                'dashboard.bookings.noAccess.description',
                                'У вашей учётной записи нет ролей owner / admin / manager ни в одном бизнесе.',
                            )}
                        </p>
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
