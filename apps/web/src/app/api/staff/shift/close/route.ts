// apps/web/src/app/api/staff/shift/close/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getStaffContext } from '@/lib/authBiz';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const { supabase, staffId } = await getStaffContext();

        const body = await req.json().catch(() => ({}));
        const totalAmountRaw = Number(body.totalAmount ?? 0);
        const consumablesAmount = Number(body.consumablesAmount ?? 0); // для обратной совместимости
        const items = Array.isArray(body.items) ? body.items : [];

        // Получаем проценты и ставку за час из настроек сотрудника
        const { data: staffData, error: staffError } = await supabase
            .from('staff')
            .select('percent_master, percent_salon, hourly_rate')
            .eq('id', staffId)
            .maybeSingle();

        if (staffError) {
            console.error('Error loading staff for percent:', staffError);
            return NextResponse.json(
                { ok: false, error: 'Не удалось загрузить настройки сотрудника' },
                { status: 500 }
            );
        }

        const percentMaster = Number(staffData?.percent_master ?? 60);
        const percentSalon = Number(staffData?.percent_salon ?? 40);

        // Валидация: проверяем суммы в items, если они переданы
        if (items.length > 0) {
            for (const it of items) {
                const serviceAmt = Number((it as { serviceAmount?: number }).serviceAmount ?? 0);
                const consumablesAmt = Number((it as { consumablesAmount?: number }).consumablesAmount ?? 0);
                if (serviceAmt < 0 || consumablesAmt < 0) {
                    return NextResponse.json(
                        { ok: false, error: 'Суммы не могут быть отрицательными' },
                        { status: 400 }
                    );
                }
            }
        } else if (totalAmountRaw < 0 || consumablesAmount < 0) {
            return NextResponse.json(
                { ok: false, error: 'Суммы не могут быть отрицательными' },
                { status: 400 }
            );
        }

        const now = new Date();
        const ymd = formatInTimeZone(now, TZ, 'yyyy-MM-dd');

        const { data: existing, error: loadError } = await supabase
            .from('staff_shifts')
            .select('*')
            .eq('staff_id', staffId)
            .eq('shift_date', ymd)
            .maybeSingle();

        if (loadError) {
            console.error('Error loading shift for close:', loadError);
            return NextResponse.json(
                { ok: false, error: loadError.message },
                { status: 500 }
            );
        }

        if (!existing) {
            return NextResponse.json(
                { ok: false, error: 'Смена на сегодня ещё не открыта' },
                { status: 400 }
            );
        }

        if (existing.status === 'closed') {
            return NextResponse.json(
                { ok: false, error: 'Смена уже закрыта' },
                { status: 400 }
            );
        }

        // Если переданы позиции по клиентам, считаем итог по ним
        const totalServiceAmount = Array.isArray(items)
            ? items.reduce(
                  (sum: number, it: { serviceAmount?: number }) => sum + Number(it?.serviceAmount ?? 0),
                  0
              )
            : 0;

        const totalConsumablesFromItems = Array.isArray(items)
            ? items.reduce(
                  (sum: number, it: { consumablesAmount?: number }) => sum + Number(it?.consumablesAmount ?? 0),
                  0
              )
            : 0;

        // Итоговая сумма услуг = сумма всех serviceAmount
        // Итоговые расходники = либо из поля consumablesAmount (если не переданы items), либо сумма consumablesAmount по клиентам
        const totalAmount = items.length > 0 ? totalServiceAmount : totalAmountRaw;
        const finalConsumablesAmount = items.length > 0 ? totalConsumablesFromItems : consumablesAmount;

        // Проценты считаются от общей суммы услуг (до вычета расходников)
        // Расходники добавляются к доле салона сверху
        
        // Проценты из настроек сотрудника (уже должны быть 100% в сумме)
        const safePercentMaster = Number.isFinite(percentMaster) ? percentMaster : 60;
        const safePercentSalon = Number.isFinite(percentSalon) ? percentSalon : 40;
        const percentSum = safePercentMaster + safePercentSalon || 100;

        const normalizedMaster = (safePercentMaster / percentSum) * 100;
        const normalizedSalon = (safePercentSalon / percentSum) * 100;

        // Доля мастера = процент от общей суммы услуг
        const masterShare = Math.round((totalAmount * normalizedMaster) / 100);
        // Доля салона = процент от общей суммы услуг + 100% расходников
        const salonShareFromAmount = Math.round((totalAmount * normalizedSalon) / 100);
        const salonShare = salonShareFromAmount + finalConsumablesAmount; // расходники 100% идут салону

        // Расчет оплаты за выход (если указана ставка за час)
        const hourlyRate = staffData?.hourly_rate ? Number(staffData.hourly_rate) : null;
        let hoursWorked: number | null = null;
        let guaranteedAmount = 0;
        let topupAmount = 0;

        if (hourlyRate && existing.opened_at) {
            // Вычисляем количество отработанных часов
            const openedAt = new Date(existing.opened_at);
            const closedAt = now;
            const diffMs = closedAt.getTime() - openedAt.getTime();
            hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // округляем до 2 знаков

            // Гарантированная сумма за выход
            guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;

            // Если гарантированная сумма больше доли мастера, владелец доплачивает разницу
            if (guaranteedAmount > masterShare) {
                topupAmount = Math.round((guaranteedAmount - masterShare) * 100) / 100;
            }
        }

        const updatePayload: {
            total_amount: number;
            consumables_amount: number;
            percent_master: number;
            percent_salon: number;
            master_share: number;
            salon_share: number;
            hours_worked: number | null;
            hourly_rate: number | null;
            guaranteed_amount: number;
            topup_amount: number;
            status: 'closed';
            closed_at: string;
        } = {
            total_amount: totalAmount,
            consumables_amount: finalConsumablesAmount,
            percent_master: normalizedMaster,
            percent_salon: normalizedSalon,
            master_share: masterShare,
            salon_share: salonShare,
            hours_worked: hoursWorked,
            hourly_rate: hourlyRate,
            guaranteed_amount: guaranteedAmount,
            topup_amount: topupAmount,
            status: 'closed' as const,
            closed_at: now.toISOString(),
        };

        const { data: updated, error: updateError } = await supabase
            .from('staff_shifts')
            .update(updatePayload)
            .eq('id', existing.id)
            .select('*')
            .maybeSingle();

        if (updateError || !updated) {
            console.error('Error closing shift:', updateError);
            return NextResponse.json(
                { ok: false, error: updateError?.message || 'Не удалось закрыть смену' },
                { status: 500 }
            );
        }

        // Перезаписываем позиции смены, если они были переданы
        if (items.length > 0) {
            const shiftId = updated.id;
            const cleanItems = items
                .map((it: {
                    clientName?: string;
                    client_name?: string;
                    serviceName?: string;
                    service_name?: string;
                    serviceAmount?: number;
                    amount?: number; // для обратной совместимости
                    consumablesAmount?: number;
                    consumables_amount?: number; // для обратной совместимости
                    bookingId?: string;
                    booking_id?: string; // для обратной совместимости
                    note?: string;
                }) => ({
                    shift_id: shiftId,
                    client_name: it.clientName ?? it.client_name ?? null,
                    service_name: it.serviceName ?? it.service_name ?? null,
                    service_amount: Number(it.serviceAmount ?? it.amount ?? 0) || 0,
                    consumables_amount: Number(it.consumablesAmount ?? it.consumables_amount ?? 0) || 0,
                    booking_id: it.bookingId ?? it.booking_id ?? null,
                    note: it.note ?? null,
                }))
                .filter((it: { service_amount: number; consumables_amount: number }) => it.service_amount > 0 || it.consumables_amount > 0);

            const { error: delError } = await supabase
                .from('staff_shift_items')
                .delete()
                .eq('shift_id', shiftId);

            if (delError) {
                console.error('Error deleting old shift items:', delError);
            } else if (cleanItems.length > 0) {
                const { error: insError } = await supabase
                    .from('staff_shift_items')
                    .insert(cleanItems);
                if (insError) {
                    console.error('Error inserting shift items:', insError);
                }
            }
        }

        return NextResponse.json({ ok: true, shift: updated });
    } catch (error) {
        console.error('Unexpected error in /api/staff/shift/close:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}


