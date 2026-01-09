// apps/web/src/app/api/staff/shift/items/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getStaffContext } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST - сохранить список клиентов для открытой смены
export async function POST(req: Request) {
    try {
        const { supabase, staffId } = await getStaffContext();

        const body = await req.json().catch(() => ({}));
        const items = Array.isArray(body.items) ? body.items : [];

        // Валидация
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

        // Находим открытую смену за сегодня
        const now = new Date();
        const ymd = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
        const todayStart = `${ymd}T00:00:00`;
        const todayEnd = `${ymd}T23:59:59`;

        const { data: existing, error: findError } = await supabase
            .from('staff_shifts')
            .select('id')
            .eq('staff_id', staffId)
            .eq('status', 'open')
            .gte('shift_date', todayStart)
            .lte('shift_date', todayEnd)
            .maybeSingle();

        if (findError) {
            console.error('Error finding open shift:', findError);
            return NextResponse.json(
                { ok: false, error: 'Не удалось найти открытую смену' },
                { status: 500 }
            );
        }

        if (!existing) {
            return NextResponse.json(
                { ok: false, error: 'Нет открытой смены. Сначала откройте смену.' },
                { status: 400 }
            );
        }

        const shiftId = existing.id;

        // Удаляем старые позиции
        const { error: deleteError } = await supabase
            .from('staff_shift_items')
            .delete()
            .eq('shift_id', shiftId);

        if (deleteError) {
            console.error('Error deleting old items:', deleteError);
            return NextResponse.json(
                { ok: false, error: 'Не удалось удалить старые позиции' },
                { status: 500 }
            );
        }

        // Вставляем новые позиции
        if (items.length > 0) {
            const cleanItems = items
                .map((it: {
                    clientName?: string;
                    client_name?: string;
                    serviceName?: string;
                    service_name?: string;
                    serviceAmount?: number;
                    amount?: number;
                    consumablesAmount?: number;
                    consumables_amount?: number;
                    bookingId?: string | null;
                    booking_id?: string | null;
                    note?: string;
                }) => ({
                    shift_id: shiftId,
                    client_name: (it.clientName ?? it.client_name ?? '').trim() || null,
                    service_name: (it.serviceName ?? it.service_name ?? '').trim() || null,
                    service_amount: Number(it.serviceAmount ?? it.amount ?? 0) || 0,
                    consumables_amount: Number(it.consumablesAmount ?? it.consumables_amount ?? 0) || 0,
                    booking_id: it.bookingId ?? it.booking_id ?? null,
                    note: it.note?.trim() || null,
                }))
                .filter((it: { service_amount: number; consumables_amount: number }) => 
                    it.service_amount > 0 || it.consumables_amount > 0
                );

            if (cleanItems.length > 0) {
                const { error: insertError } = await supabase
                    .from('staff_shift_items')
                    .insert(cleanItems);

                if (insertError) {
                    console.error('Error inserting items:', insertError);
                    return NextResponse.json(
                        { ok: false, error: 'Не удалось сохранить позиции' },
                        { status: 500 }
                    );
                }

                // Обновляем статус записей на "пришел" (paid), если они были добавлены в смену
                const admin = getServiceClient();
                const bookingIds = cleanItems
                    .map((it: { booking_id: string | null }) => it.booking_id)
                    .filter((id: string | null): id is string => !!id);

                if (bookingIds.length > 0) {
                    // Используем RPC функцию для обновления статуса
                    for (const bookingId of bookingIds) {
                        try {
                            const { error: rpcError } = await admin.rpc('update_booking_status_no_check', {
                                p_booking_id: bookingId,
                                p_new_status: 'paid',
                            });
                            if (rpcError && !rpcError.message?.includes('function') && !rpcError.message?.includes('does not exist')) {
                                // Если RPC не работает, используем прямой update
                                await admin
                                    .from('bookings')
                                    .update({ status: 'paid' })
                                    .eq('id', bookingId);
                            }
                        } catch (e) {
                            console.error(`Error updating booking ${bookingId} status:`, e);
                        }
                    }
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('Error saving shift items:', e);
        return NextResponse.json(
            { ok: false, error: 'Ошибка при сохранении данных' },
            { status: 500 }
        );
    }
}

