import { formatInTimeZone } from 'date-fns-tz';

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
        return <main className="p-6 text-red-600">Сотрудник не найден или нет доступа</main>;
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
        return <main className="p-6 text-red-600">Ошибка загрузки услуг: {svcErr.message}</main>;
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

    return (
        <main className="mx-auto max-w-4xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Свободные слоты — {staff.full_name}</h1>
                <a className="underline text-sm" href={`/dashboard/staff/${staff.id}`}>
                    ← к карточке
                </a>
            </div>

            {services.length === 0 && (
                <div className="border rounded p-3 text-sm bg-yellow-50 border-yellow-300 text-yellow-900">
                    Этому сотруднику пока не назначены услуги. Назначьте услуги на странице сотрудника
                    (раздел «Услуги»), чтобы видеть свободные слоты.
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
}
