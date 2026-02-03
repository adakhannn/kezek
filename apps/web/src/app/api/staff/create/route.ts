export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import {getBizContextForManagers} from '@/lib/authBiz';
import {initializeStaffSchedule} from '@/lib/staffSchedule';
import {getServiceClient} from '@/lib/supabaseService';
import {withErrorHandler, createErrorResponse, createSuccessResponse} from '@/lib/apiErrorHandler';

/**
 * Добавляет роль staff пользователю в бизнесе (idempotent)
 */
async function addStaffRole(admin: ReturnType<typeof getServiceClient>, userId: string, bizId: string): Promise<void> {
    const { data: roleStaff } = await admin
        .from('roles')
        .select('id')
        .eq('key', 'staff')
        .maybeSingle();
    
    if (!roleStaff?.id) {
        console.warn('Staff role not found in roles table');
        return;
    }

    // Проверяем, нет ли уже такой роли
    const { data: existsRole } = await admin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_id', roleStaff.id)
        .eq('biz_id', bizId)
        .maybeSingle();

    if (!existsRole) {
        const { error: eRole } = await admin
            .from('user_roles')
            .insert({
                user_id: userId,
                biz_id: bizId,
                role_id: roleStaff.id,
                // biz_key имеет DEFAULT значение, не вставляем явно
            });
        if (eRole) {
            console.warn('Failed to add staff role:', eRole.message);
        }
    }
}

type Body = {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    branch_id: string;
    is_active: boolean;
};

export async function POST(req: Request) {
    return withErrorHandler('StaffCreate', async () => {
        const {supabase, userId, bizId} = await getBizContextForManagers();

        // проверка роли в этом бизнесе
        const {data: roles} = await supabase
            .from('user_roles')
            .select('roles!inner(key)')
            .eq('user_id', userId)
            .eq('biz_id', bizId);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ok = (roles ?? []).some(r => (r as any).roles?.key && ['owner', 'admin', 'manager'].includes((r as any).roles.key));
        if (!ok) {
            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
        }

        const body = (await req.json()) as Body;
        if (!body.full_name || !body.branch_id) {
            return createErrorResponse('validation', 'Имя и филиал обязательны', undefined, 400);
        }

        // Используем service client для поиска пользователя и добавления роли
        const admin = getServiceClient();
        let linkedUserId: string | null = null;

        // Пытаемся найти существующего пользователя по email или phone
        if (body.email || body.phone) {
            const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
            const foundUser = userList?.users?.find(u => {
                if (body.email && u.email === body.email) return true;
                if (body.phone && u.phone === body.phone) return true;
                return false;
            });
            if (foundUser) {
                linkedUserId = foundUser.id;
            }
        }

        const {data, error} = await supabase
            .from('staff')
            .insert({
                biz_id: bizId,
                branch_id: body.branch_id,
                full_name: body.full_name,
                email: body.email ?? null,
                phone: body.phone ?? null,
                is_active: !!body.is_active,
                user_id: linkedUserId,
            })
            .select('id')
            .single();

        if (error) {
            return createErrorResponse('validation', error.message, undefined, 400);
        }

        // Создаём первую запись в истории закреплений сотрудника за филиалом
        try {
            const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            const { error: eAssign } = await admin.from('staff_branch_assignments').insert({
                biz_id: bizId,
                staff_id: data?.id,
                branch_id: body.branch_id,
                valid_from: todayISO,
            });
            if (eAssign) {
                console.warn('Failed to create initial staff_branch_assignments row:', eAssign.message);
            }
        } catch (e) {
            console.warn('Unexpected error while creating staff_branch_assignments row:', e);
        }

        // Если нашли пользователя, добавляем роль staff
        if (linkedUserId) {
            await addStaffRole(admin, linkedUserId, bizId);
        }

        // Инициализируем расписание для нового сотрудника (текущая и следующая недели)
        let scheduleResult: Awaited<ReturnType<typeof initializeStaffSchedule>> = { success: false, daysCreated: 0 };
        if (data?.id) {
            console.log(`[staff/create] Initializing schedule for new staff ${data.id}, branch ${body.branch_id}`);
            try {
                scheduleResult = await initializeStaffSchedule(admin, bizId, data.id, body.branch_id);
                console.log(`[staff/create] Schedule initialization completed for staff ${data.id}:`, scheduleResult);
            } catch (scheduleError) {
                const errorMsg = scheduleError instanceof Error ? scheduleError.message : String(scheduleError);
                console.error(`[staff/create] Schedule initialization failed for staff ${data.id}:`, errorMsg);
                scheduleResult = { success: false, daysCreated: 0, error: errorMsg };
            }
        } else {
            console.warn('[staff/create] No staff ID returned, cannot initialize schedule');
        }

        return createSuccessResponse({
            id: data?.id,
            user_linked: !!linkedUserId,
            schedule_initialized: scheduleResult.success,
            schedule_days_created: scheduleResult.daysCreated,
            schedule_error: scheduleResult.error || null,
        });
    });
}
