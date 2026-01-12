// apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/delete/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient, type PostgrestError} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

// Аккуратно парсим id и branchId из URL, без any
function extractIds(urlStr: string): { id: string; branchId: string } {
    const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
    // .../admin/api/businesses/{id}/branches/{branchId}/delete
    const iBiz = parts.findIndex(p => p === 'businesses');
    const iBranches = parts.findIndex((p, i) => i > iBiz && p === 'branches');
    const id = iBiz >= 0 ? parts[iBiz + 1] ?? '' : '';
    const branchId = iBranches >= 0 ? parts[iBranches + 1] ?? '' : '';
    return {id, branchId};
}

export async function POST(req: Request) {
    try {
        const {id, branchId} = extractIds(req.url);

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        const admin = createClient(URL, SERVICE);

        // 1) Проверяем, что филиал существует и принадлежит бизнесу
        const { data: br } = await admin
            .from('branches')
            .select('id,biz_id')
            .eq('id', branchId)
            .maybeSingle();
        if (!br || String(br.biz_id) !== String(id)) {
            return NextResponse.json({ ok: false, error: 'BRANCH_NOT_IN_THIS_BUSINESS' }, { status: 400 });
        }

        // 2) Проверяем наличие активных услуг
        const { count: servicesCount } = await admin
            .from('services')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', id)
            .eq('branch_id', branchId)
            .eq('active', true);

        if ((servicesCount ?? 0) > 0) {
            return NextResponse.json({ 
                ok: false, 
                error: 'HAS_SERVICES',
                message: 'Невозможно удалить филиал: к нему привязаны активные услуги. Сначала удалите или переместите все активные услуги.'
            }, { status: 400 });
        }

        // 3) Проверяем наличие активных сотрудников
        const { count: staffCount } = await admin
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', id)
            .eq('branch_id', branchId)
            .eq('is_active', true);

        if ((staffCount ?? 0) > 0) {
            return NextResponse.json({ 
                ok: false, 
                error: 'HAS_STAFF',
                message: 'Невозможно удалить филиал: к нему привязаны активные сотрудники. Сначала удалите или переместите всех активных сотрудников.'
            }, { status: 400 });
        }

        // 4) Проверяем наличие бронирований (включая отмененные для информации)
        const { data: allBookings, count: allBookingsCount } = await admin
            .from('bookings')
            .select('id,status,start_at,client_name', { count: 'exact' })
            .eq('biz_id', id)
            .eq('branch_id', branchId)
            .limit(20);

        const { count: activeBookingsCount } = await admin
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', id)
            .eq('branch_id', branchId)
            .neq('status', 'cancelled');

        const cancelledCount = (allBookingsCount ?? 0) - (activeBookingsCount ?? 0);

        if ((activeBookingsCount ?? 0) > 0) {
            const activeBookings = allBookings?.filter(b => b.status !== 'cancelled') || [];
            return NextResponse.json({ 
                ok: false, 
                error: 'HAS_BOOKINGS',
                message: `Невозможно удалить филиал: к нему привязаны активные (неотмененные) брони. Сначала отмените или удалите все активные брони.`,
                details: {
                    total: allBookingsCount ?? 0,
                    active: activeBookingsCount ?? 0,
                    cancelled: cancelledCount,
                    bookings: activeBookings.slice(0, 5),
                }
            }, { status: 400 });
        }

        // 5) Удаляем отмененные бронирования, чтобы они не блокировали удаление через FK
        if (cancelledCount > 0) {
            const { error: eDelCancelled } = await admin
                .from('bookings')
                .delete()
                .eq('biz_id', id)
                .eq('branch_id', branchId)
                .eq('status', 'cancelled');

            if (eDelCancelled) {
                console.warn(`Не удалось удалить отмененные бронирования: ${eDelCancelled.message}`);
                // Не блокируем удаление из-за этого, но логируем
            } else {
                console.log(`Удалено ${cancelledCount} отмененных бронирований для филиала ${branchId}`);
            }
        }

        // 6) Перемещаем неактивных сотрудников в другой филиал (если есть)
        const { data: otherBranch } = await admin
            .from('branches')
            .select('id')
            .eq('biz_id', id)
            .neq('id', branchId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (otherBranch) {
            const { error: eMoveStaff } = await admin
                .from('staff')
                .update({ branch_id: otherBranch.id })
                .eq('biz_id', id)
                .eq('branch_id', branchId)
                .eq('is_active', false);

            if (eMoveStaff) {
                console.warn('Не удалось переместить неактивных сотрудников:', eMoveStaff.message);
            }
        }

        // 7) Очищаем историю привязок мастеров к филиалам (staff_branch_assignments)
        // Эти записи используются только для истории / логики расписания и не должны блокировать удаление тестового филиала
        const { error: eDelAssignments } = await admin
            .from('staff_branch_assignments')
            .delete()
            .eq('biz_id', id)
            .eq('branch_id', branchId);

        if (eDelAssignments) {
            console.warn('Не удалось удалить строки из staff_branch_assignments:', eDelAssignments.message);
            // Не блокируем удаление филиала, но логируем проблему
        }
        
        // 8) Удаляем филиал
        const { error } = await admin
            .from('branches')
            .delete()
            .eq('id', branchId)
            .eq('biz_id', id);

        if (error) {
            const pgErr = error as PostgrestError;
            
            // Если это foreign key constraint, пытаемся найти, что именно блокирует
            if (pgErr.code === '23503' || /foreign key/i.test(pgErr.message)) {
                // Проверяем все возможные связи еще раз для детального сообщения
                const [
                    { count: finalServicesCount },
                    { count: finalStaffCount },
                    { count: finalBookingsCount },
                ] = await Promise.all([
                    admin.from('services').select('id', { count: 'exact', head: true }).eq('biz_id', id).eq('branch_id', branchId),
                    admin.from('staff').select('id', { count: 'exact', head: true }).eq('biz_id', id).eq('branch_id', branchId),
                    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('biz_id', id).eq('branch_id', branchId).neq('status', 'cancelled'),
                ]);

                const blockers: string[] = [];
                if ((finalServicesCount ?? 0) > 0) blockers.push(`${finalServicesCount} услуги`);
                if ((finalStaffCount ?? 0) > 0) blockers.push(`${finalStaffCount} сотрудники`);
                if ((finalBookingsCount ?? 0) > 0) blockers.push(`${finalBookingsCount} активные бронирования`);

                const friendly = blockers.length > 0
                    ? `Нельзя удалить: филиал используется (${blockers.join(', ')}). Сначала перенесите или удалите связанные данные.`
                    : 'Нельзя удалить: филиал используется. Проверьте все связанные данные (услуги, сотрудники, бронирования, расписание).';
                
                return NextResponse.json({ 
                    ok: false, 
                    error: friendly,
                    details: {
                        services: finalServicesCount ?? 0,
                        staff: finalStaffCount ?? 0,
                        bookings: finalBookingsCount ?? 0,
                    }
                }, { status: 400 });
            }
            
            return NextResponse.json({ ok: false, error: pgErr.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        console.error('branch delete error', e);
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

// поддержим HTTP DELETE
export const DELETE = POST;
