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
        const consumablesAmount = Number(body.consumablesAmount ?? 0);
        const percentMaster = Number(body.percentMaster ?? 60);
        const percentSalon = Number(body.percentSalon ?? 40);
        const items = Array.isArray(body.items) ? body.items : [];

        if (totalAmountRaw < 0 || consumablesAmount < 0) {
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
        const totalAmountFromItems = Array.isArray(items)
            ? items.reduce(
                  (sum: number, it: { amount?: number }) => sum + Number(it?.amount ?? 0),
                  0
              )
            : 0;

        const totalAmount = items.length > 0 ? totalAmountFromItems : totalAmountRaw;

        const net = Math.max(0, totalAmount - consumablesAmount);
        const safePercentMaster = Number.isFinite(percentMaster) ? percentMaster : 60;
        const safePercentSalon = Number.isFinite(percentSalon) ? percentSalon : 40;
        const percentSum = safePercentMaster + safePercentSalon || 100;

        const normalizedMaster = (safePercentMaster / percentSum) * 100;
        const normalizedSalon = (safePercentSalon / percentSum) * 100;

        const masterShare = Math.round((net * normalizedMaster) / 100);
        const salonShare = Math.max(0, net - masterShare);

        const updatePayload = {
            total_amount: totalAmount,
            consumables_amount: consumablesAmount,
            percent_master: normalizedMaster,
            percent_salon: normalizedSalon,
            master_share: masterShare,
            salon_share: salonShare,
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
                .map((it: any) => ({
                    shift_id: shiftId,
                    client_name: it.clientName ?? it.client_name ?? null,
                    service_name: it.serviceName ?? it.service_name ?? null,
                    amount: Number(it.amount ?? 0) || 0,
                    note: it.note ?? null,
                }))
                .filter((it: { amount: number }) => it.amount > 0);

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


