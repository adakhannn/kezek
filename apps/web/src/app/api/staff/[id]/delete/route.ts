export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export async function POST(_: Request, context: unknown) {
    try {
        const staffId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        // 1) читаем сотрудника
        const { data: staff, error: eStaff } = await admin
            .from('staff')
            .select('id,biz_id,user_id,is_active,full_name')
            .eq('id', staffId)
            .maybeSingle();

        if (eStaff) return NextResponse.json({ ok: false, error: eStaff.message }, { status: 400 });
        if (!staff || String(staff.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'STAFF_NOT_FOUND' }, { status: 404 });
        }

        // 2) есть ли будущие активные записи?
        const nowIso = new Date().toISOString();
        const { count: futureBookingsCount, error: eBooks } = await admin
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .neq('status', 'cancelled')
            .gt('start_at', nowIso);

        if (eBooks) return NextResponse.json({ ok: false, error: eBooks.message }, { status: 400 });
        if ((futureBookingsCount ?? 0) > 0) {
            return NextResponse.json({ 
                ok: false, 
                error: 'HAS_FUTURE_BOOKINGS',
                message: 'Невозможно удалить сотрудника: у него есть будущие активные брони. Сначала отмените все будущие брони.'
            }, { status: 409 });
        }

        // 3) Удаляем все прошедшие брони (чтобы обойти FK-ограничения)
        const { error: eDelPastBookings } = await admin
            .from('bookings')
            .delete()
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .lt('start_at', nowIso);

        if (eDelPastBookings) {
            return NextResponse.json({ 
                ok: false, 
                error: `Не удалось удалить прошедшие брони: ${eDelPastBookings.message}` 
            }, { status: 400 });
        }

        // 4) Удаляем расписание (working_hours)
        const { error: eDelWorkingHours } = await admin
            .from('working_hours')
            .delete()
            .eq('biz_id', bizId)
            .eq('staff_id', staffId);

        if (eDelWorkingHours) {
            return NextResponse.json({ 
                ok: false, 
                error: `Не удалось удалить расписание: ${eDelWorkingHours.message}` 
            }, { status: 400 });
        }

        // 5) Удаляем связи с услугами (service_staff)
        const { error: eDelServiceStaff } = await admin
            .from('service_staff')
            .delete()
            .eq('staff_id', staffId);

        if (eDelServiceStaff) {
            return NextResponse.json({ 
                ok: false, 
                error: `Не удалось удалить связи с услугами: ${eDelServiceStaff.message}` 
            }, { status: 400 });
        }

        // 6) Удаляем назначения на филиалы (staff_branch_assignments)
        const { error: eDelAssignments } = await admin
            .from('staff_branch_assignments')
            .delete()
            .eq('biz_id', bizId)
            .eq('staff_id', staffId);

        if (eDelAssignments) {
            return NextResponse.json({ 
                ok: false, 
                error: `Не удалось удалить назначения на филиалы: ${eDelAssignments.message}` 
            }, { status: 400 });
        }

        // 7) Удаляем правила расписания (staff_schedule_rules)
        const { error: eDelRules } = await admin
            .from('staff_schedule_rules')
            .delete()
            .eq('biz_id', bizId)
            .eq('staff_id', staffId);

        if (eDelRules) {
            return NextResponse.json({ 
                ok: false, 
                error: `Не удалось удалить правила расписания: ${eDelRules.message}` 
            }, { status: 400 });
        }

        // 8) Удаляем отпуска/выходные (staff_time_off)
        const { error: eDelTimeOff } = await admin
            .from('staff_time_off')
            .delete()
            .eq('biz_id', bizId)
            .eq('staff_id', staffId);

        if (eDelTimeOff) {
            return NextResponse.json({ 
                ok: false, 
                error: `Не удалось удалить отпуска: ${eDelTimeOff.message}` 
            }, { status: 400 });
        }

        // 9) Если привязан к пользователю — понизить роли до client
        if (staff.user_id) {
            const svc = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { persistSession: false } }
            );

            const { data: roleClient, error: eRoleCli } = await svc
                .from('roles')
                .select('id')
                .eq('key', 'client')
                .maybeSingle();

            if (eRoleCli || !roleClient?.id) {
                return NextResponse.json({ ok: false, error: 'ROLE_CLIENT_NOT_FOUND' }, { status: 500 });
            }

            // Снимаем все бизнес-роли, кроме client
            const { error: eDelete } = await svc
                .from('user_roles')
                .delete()
                .eq('user_id', staff.user_id)
                .eq('biz_id', bizId)
                .neq('role_id', roleClient.id);

            if (eDelete) {
                return NextResponse.json({ ok: false, error: eDelete.message }, { status: 400 });
            }

            // Гарантируем, что client есть
            const { data: roleClientId } = await svc
                .from('roles')
                .select('id')
                .eq('key', 'client')
                .maybeSingle();

            await svc
                .from('user_roles')
                .upsert(
                    { user_id: staff.user_id, biz_id: bizId, role_id: roleClientId!.id },
                    { onConflict: 'user_id,role_id,biz_key' }
                );
        }

        // 10) Удаляем самого сотрудника
        const { error: eDelStaff } = await admin
            .from('staff')
            .delete()
            .eq('id', staffId)
            .eq('biz_id', bizId);

        if (eDelStaff) {
            return NextResponse.json({ ok: false, error: eDelStaff.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

