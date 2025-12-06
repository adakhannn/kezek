import { redirect } from 'next/navigation';

import BookingsClient from './view';

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
                .select('id,name_ru,duration_min,active,branch_id')
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
            .select('id,status,start_at,end_at,services(name_ru),staff(full_name)')
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
        return <main className="p-6">Нет доступа к кабинету.</main>;
    }
}
