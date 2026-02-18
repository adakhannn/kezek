import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';

const BookingsClient = dynamic(() => import('./view'), {
    ssr: false,
    loading: () => (
        <main className="p-6">
            <div className="text-sm text-gray-600">Загрузка…</div>
        </main>
    ),
});

import { getBizContextForManagers } from '@/lib/authBiz'; // <-- твой рабочий хелпер

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page() {
    try {
        const { supabase, bizId } = await getBizContextForManagers();

        // 1) Данные для страницы (ВАЖНО: branch_id у services и staff)
        const [{ data: services }, { data: staff }, { data: branches }] = await Promise.all([
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

        // 2) Последние брони (для вкладки «Список»)
        const { data: bookings } = await supabase
            .from('bookings')
            .select('id,status,start_at,end_at,services(name_ru,name_ky),staff(full_name)')
            .eq('biz_id', bizId)
            .order('start_at', { ascending: false })
            .limit(30);

        return (
            <BookingsClient
                bizId={bizId}
                services={services || []}
                staff={staff || []}
                branches={branches || []}
                initial={bookings || []}
            />
        );
    } catch (e: unknown) {
        // нет сессии → уводим на публичную
        if (e instanceof Error && e.message === 'UNAUTHORIZED') {
            redirect('/b/kezek');
        }
        // нет подходящего бизнеса → мягкое сообщение
        if (e instanceof Error && e.message === 'NO_BIZ_ACCESS') {
            return (
                <main className="p-6">
                    <h1 className="text-xl font-semibold mb-2">Нет доступа к кабинету</h1>
                    <p className="text-sm text-gray-600">
                        У вашей учётной записи нет ролей <code>owner / admin / manager</code> ни в одном бизнесе.
                    </p>
                </main>
            );
        }
        // Другие ошибки
        return (
            <main className="p-6">
                <h1 className="text-xl font-semibold mb-2 text-red-600">Ошибка</h1>
                <p className="text-sm text-gray-600">
                    Произошла ошибка при загрузке броней. Пожалуйста, попробуйте обновить страницу.
                </p>
                {e instanceof Error && (
                    <p className="text-xs text-gray-500 mt-2">Детали: {e.message}</p>
                )}
            </main>
        );
    }
}
