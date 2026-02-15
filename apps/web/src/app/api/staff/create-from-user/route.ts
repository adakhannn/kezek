export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logDebug, logWarn, logError } from '@/lib/log';
import { initializeStaffSchedule } from '@/lib/staffSchedule';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    user_id: string;
    branch_id: string;
    is_active?: boolean;
};

export async function POST(req: Request) {
    try {
        // Доступ уже проверен внутри (владелец по owner_id ИЛИ owner/admin/manager по user_roles)
        const {bizId } = await getBizContextForManagers();

        const body = (await req.json()) as Body;
        if (!body.user_id || !body.branch_id) {
            return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
        }

        // service-клиентом обойдём RLS для мутаций
        const admin = getServiceClient();

        // 1) Проверим, что branch принадлежит этому бизнесу (используем унифицированную утилиту)
        const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
            admin,
            'branches',
            body.branch_id,
            bizId,
            'id, biz_id'
        );
        if (branchCheck.error || !branchCheck.data) {
            return NextResponse.json({ ok: false, error: 'BRANCH_NOT_IN_THIS_BUSINESS' }, { status: 400 });
        }

        // 2) Подтянем пользователя из Auth Admin API
        const { data: list, error: eList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (eList) return NextResponse.json({ ok: false, error: eList.message }, { status: 400 });
        const u = (list.users ?? []).find(x => x.id === body.user_id);
        if (!u) return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 });

        const meta = (u.user_metadata ?? {});
        const full_name = String(meta.full_name ?? meta.fullName ?? u.email ?? 'Без имени');
        const email = u.email ?? null;
        const phone = u.phone ?? null;

        // 3) Создаём запись staff (если вдруг уже есть — можно не дублировать)
        const { data: existingStaff } = await admin
            .from('staff')
            .select('id')
            .eq('biz_id', bizId)
            .eq('full_name', full_name)
            .limit(1)
            .maybeSingle();

        let staffId = existingStaff?.id as string | undefined;

        if (!staffId) {
            const { data: inserted, error: eIns } = await admin
                .from('staff')
                .insert({
                    biz_id: bizId,
                    branch_id: body.branch_id,
                    full_name,
                    email,
                    phone,
                    is_active: body.is_active ?? true,
                    user_id: body.user_id, // ВАЖНО: привязываем к пользователю
                })
                .select('id')
                .single();
            if (eIns) return NextResponse.json({ ok: false, error: eIns.message }, { status: 400 });
            staffId = inserted?.id as string;
        } else {
            // Если сотрудник уже существует, обновляем user_id, если его еще нет
            const { data: existingStaff } = await admin
                .from('staff')
                .select('user_id')
                .eq('id', staffId)
                .maybeSingle();
            
            if (existingStaff && !existingStaff.user_id) {
                await admin
                    .from('staff')
                    .update({ user_id: body.user_id })
                    .eq('id', staffId);
            }
        }

        // 3.1) Гарантируем наличие записи в истории закреплений (staff_branch_assignments)
        if (staffId) {
            try {
                const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

                // Проверяем, есть ли уже активное назначение на этот филиал
                const { data: existingAssign } = await admin
                    .from('staff_branch_assignments')
                    .select('id')
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId)
                    .eq('branch_id', body.branch_id)
                    .is('valid_to', null)
                    .maybeSingle();

                if (!existingAssign) {
                    const { error: eAssign } = await admin.from('staff_branch_assignments').insert({
                        biz_id: bizId,
                        staff_id: staffId,
                        branch_id: body.branch_id,
                        valid_from: todayISO,
                    });
                    if (eAssign) {
                        logWarn('StaffCreateFromUser', 'Failed to create staff_branch_assignments row', { message: eAssign.message });
                    }
                }
            } catch (e) {
                logWarn('StaffCreateFromUser', 'Unexpected error while creating staff_branch_assignments row', e);
            }
        }

        // 4) Выдаём роль staff пользователю в этом бизнесе (id роли по key='staff')
        const { data: roleStaff } = await admin
            .from('roles')
            .select('id')
            .eq('key', 'staff')
            .maybeSingle();
        if (!roleStaff?.id) return NextResponse.json({ ok: false, error: 'ROLE_STAFF_NOT_FOUND' }, { status: 400 });

        // upsert вручную: если записи нет — вставим
        const { data: existsRole } = await admin
            .from('user_roles')
            .select('id')
            .eq('user_id', body.user_id)
            .eq('role_id', roleStaff.id)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (!existsRole) {
            const { error: eRole } = await admin
                .from('user_roles')
                .insert({
                    user_id: body.user_id,
                    role_id: roleStaff.id,
                    biz_id: bizId,
                    // biz_key имеет DEFAULT значение, не вставляем явно
                });
            if (eRole) return NextResponse.json({ ok: true, id: staffId, warn: 'ROLE_NOT_GRANTED', error: eRole.message });
        }

        // Инициализируем расписание для нового сотрудника (текущая и следующая недели)
        let scheduleResult: Awaited<ReturnType<typeof initializeStaffSchedule>> = { success: false, daysCreated: 0 };
        if (staffId) {
            logDebug('StaffCreateFromUser', 'Initializing schedule for new staff', { staffId, branchId: body.branch_id });
            try {
                scheduleResult = await initializeStaffSchedule(admin, bizId, staffId, body.branch_id);
                logDebug('StaffCreateFromUser', 'Schedule initialization completed', { staffId, result: scheduleResult });
            } catch (scheduleError) {
                const errorMsg = scheduleError instanceof Error ? scheduleError.message : String(scheduleError);
                logError('StaffCreateFromUser', 'Schedule initialization failed', { staffId, error: errorMsg });
                scheduleResult = { success: false, daysCreated: 0, error: errorMsg };
            }
        } else {
            logWarn('StaffCreateFromUser', 'No staff ID, cannot initialize schedule');
        }

        return NextResponse.json({
            ok: true,
            id: staffId,
            schedule_initialized: scheduleResult.success,
            schedule_days_created: scheduleResult.daysCreated,
            schedule_error: scheduleResult.error || null,
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
