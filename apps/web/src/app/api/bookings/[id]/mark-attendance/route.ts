// apps/web/src/app/api/bookings/[id]/mark-attendance/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    attended: boolean; // true = пришел, false = не пришел
};

export async function POST(req: Request, context: unknown) {
    try {
        const bookingId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = await req.json().catch(() => ({} as Body));
        const attended = body.attended === true;

        // Проверяем, что бронь принадлежит этому бизнесу
        const { data: booking, error: bookingError } = await admin
            .from('bookings')
            .select('id, biz_id, start_at, status')
            .eq('id', bookingId)
            .maybeSingle();

        if (bookingError) {
            return NextResponse.json({ ok: false, error: bookingError.message }, { status: 400 });
        }

        if (!booking) {
            return NextResponse.json({ ok: false, error: 'Бронь не найдена' }, { status: 404 });
        }

        if (String(booking.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
        }

        // Если статус уже финальный, не пытаемся применять его повторно
        if (booking.status === 'paid' || booking.status === 'no_show') {
            return NextResponse.json({ ok: true, status: booking.status });
        }

        // Проверяем, что бронь уже прошла
        const now = new Date();
        const startAt = new Date(booking.start_at);
        if (startAt > now) {
            return NextResponse.json({
                ok: false,
                error: 'Можно отмечать посещение только для прошедших броней',
            }, { status: 400 });
        }

        // Обновляем статус: attended = true -> paid (выполнено/пришел), attended = false -> no_show
        // Примечание: статус "paid" означает "выполнено/пришел", а не "оплачено"
        const newStatus = attended ? 'paid' : 'no_show';

        // Если статус = 'paid', используем функцию с автоматическим применением акций
        // Иначе используем стандартную функцию обновления статуса
        const rpcFunctionName = newStatus === 'paid' 
            ? 'update_booking_status_with_promotion' 
            : 'update_booking_status_no_check';

        // Применяем статус (и акцию, если статус = 'paid')
        const { error: rpcError, data: promotionResult } = await admin.rpc(rpcFunctionName, {
            p_booking_id: bookingId,
            p_new_status: newStatus,
        });

        // Если RPC успешно выполнен, возвращаем успех
        if (!rpcError) {
            // Если применялась акция, возвращаем информацию о ней
            if (newStatus === 'paid' && promotionResult) {
                const result = promotionResult as { applied?: boolean; promotion_title?: string; discount_percent?: number; discount_amount?: number; final_amount?: number } | null;
                const applied = result?.applied || false;
                
                return NextResponse.json({ 
                    ok: true, 
                    status: newStatus,
                    promotion_applied: applied,
                    promotion_info: applied ? {
                        title: result?.promotion_title || '',
                        discount_percent: result?.discount_percent || 0,
                        discount_amount: result?.discount_amount || 0,
                        final_amount: result?.final_amount || 0,
                    } : null,
                });
            }
            return NextResponse.json({ ok: true, status: newStatus });
        }

        // Если RPC функция не найдена или не работает, используем прямой update через service client
        // Service client должен обходить большинство проверок
        if (rpcError && (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist') || rpcError.message?.includes('schema cache'))) {
            // Fallback: прямой update через service client
            const { error: updateError, data } = await admin
                .from('bookings')
                .update({ status: newStatus })
                .eq('id', bookingId)
                .select('id, status');

            if (updateError) {
                const errorMsg = updateError.message.toLowerCase();
                // Если ошибка о назначении сотрудника, это не критично для прошедших броней
                // Бронь уже существует, и мы просто меняем её статус
                if (errorMsg.includes('not assigned to branch') || errorMsg.includes('staff')) {
                    // Для прошедших броней игнорируем ошибку о назначении
                    // Проверяем, что статус все же обновился
                    const { data: checkData } = await admin
                        .from('bookings')
                        .select('status')
                        .eq('id', bookingId)
                        .maybeSingle();
                    
                    if (checkData && checkData.status === newStatus) {
                        // Статус обновился, несмотря на ошибку
                        return NextResponse.json({ ok: true, status: newStatus });
                    }
                    
                    // Если статус не обновился, возвращаем ошибку
                    return NextResponse.json({
                        ok: false,
                        error: 'Не удалось обновить статус. Возможно, сотрудник больше не назначен на филиал.',
                    }, { status: 400 });
                } else {
                    return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
                }
            }
            
            // Успешно обновлено
            return NextResponse.json({ ok: true, status: newStatus });
        }

        // Если это не ошибка "функция не найдена", возвращаем ошибку RPC
        return NextResponse.json({ ok: false, error: rpcError?.message || 'Неизвестная ошибка' }, { status: 400 });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

