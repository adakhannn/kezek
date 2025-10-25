import {formatInTimeZone} from 'date-fns-tz';

import Client from './Client';

import {getBizContextForManagers} from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffSlotsPage({params}: { params: { id: string } }) {
    const {supabase, bizId} = await getBizContextForManagers();

    // загружаем сотрудника, услуги и филиалы бизнеса
    const [{data: staff}, {data: services}, {data: branches}] = await Promise.all([
        supabase.from('staff')
            .select('id, full_name, is_active, biz_id')
            .eq('id', params.id)
            .maybeSingle(),
        supabase.from('services')
            .select('id, name_ru, duration_min, branch_id, active')
            .eq('biz_id', bizId)
            .eq('active', true)
            .order('name_ru'),
        supabase.from('branches')
            .select('id, name, is_active')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name'),
    ]);

    if (!staff || String(staff.biz_id) !== String(bizId)) {
        return <main className="p-6 text-red-600">Сотрудник не найден или нет доступа</main>;
    }

    const today = formatInTimeZone(new Date(), 'Asia/Bishkek', 'yyyy-MM-dd');

    return (
        <main className="mx-auto max-w-4xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Свободные слоты — {staff.full_name}</h1>
                <a className="underline text-sm" href={`/dashboard/staff/${staff.id}`}>← к карточке</a>
            </div>

            <Client
                bizId={bizId}
                staffId={staff.id}
                services={(services ?? []).map(s => ({
                    id: s.id,
                    name: s.name_ru,
                    duration_min: s.duration_min,
                    branch_id: s.branch_id
                }))}
                branches={(branches ?? []).map(b => ({id: b.id, name: b.name}))}
                defaultDate={today}
            />
        </main>
    );
}
