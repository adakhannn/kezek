import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logWarn } from '@/lib/log';

type Result =
    | {
          ok: false;
          statusCode: 400 | 409;
          errorType: 'validation' | 'conflict' | 'internal';
          message: string;
          details?: Record<string, unknown>;
      }
    | {
          ok: true;
      };

export async function runBranchDelete({
    admin,
    branchId,
    bizId,
}: {
    admin: any;
    branchId: string;
    bizId: string;
}): Promise<Result> {
    const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
        admin,
        'branches',
        branchId,
        bizId,
        'id, biz_id',
    );
    if (branchCheck.error || !branchCheck.data) {
        return {
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message: branchCheck.error || 'Филиал не принадлежит этому бизнесу',
        };
    }

    const { count: servicesCount } = await admin
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('biz_id', bizId)
        .eq('branch_id', branchId)
        .eq('active', true);

    if ((servicesCount ?? 0) > 0) {
        return {
            ok: false,
            statusCode: 400,
            errorType: 'conflict',
            message:
                'Невозможно удалить филиал: к нему привязаны активные услуги. Сначала удалите или переместите все активные услуги.',
        };
    }

    const { count: staffCount } = await admin
        .from('staff')
        .select('id', { count: 'exact', head: true })
        .eq('biz_id', bizId)
        .eq('branch_id', branchId)
        .eq('is_active', true);

    if ((staffCount ?? 0) > 0) {
        return {
            ok: false,
            statusCode: 400,
            errorType: 'conflict',
            message:
                'Невозможно удалить филиал: к нему привязаны активные сотрудники. Сначала удалите или переместите всех активных сотрудников.',
        };
    }

    const { data: activeBookings, count: activeBookingsCount } = await admin
        .from('bookings')
        .select('id,status,start_at,client_name,service_id', { count: 'exact' })
        .eq('biz_id', bizId)
        .eq('branch_id', branchId)
        .neq('status', 'cancelled')
        .limit(10);

    if ((activeBookingsCount ?? 0) > 0) {
        return {
            ok: false,
            statusCode: 400,
            errorType: 'conflict',
            message:
                'Невозможно удалить филиал: к нему привязаны активные (неотмененные) брони. Сначала отмените или удалите все активные брони.',
            details: {
                total: activeBookingsCount ?? 0,
                active: activeBookingsCount ?? 0,
                cancelled: 0,
                bookings: activeBookings?.slice(0, 5) || [],
            },
        };
    }

    const { data: otherBranch } = await admin
        .from('branches')
        .select('id')
        .eq('biz_id', bizId)
        .neq('id', branchId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

    if (otherBranch) {
        const { error: moveStaffError } = await admin
            .from('staff')
            .update({ branch_id: otherBranch.id })
            .eq('biz_id', bizId)
            .eq('branch_id', branchId)
            .eq('is_active', false);

        if (moveStaffError) {
            logWarn('BranchDelete', 'Не удалось переместить неактивных сотрудников', moveStaffError);
        }
    }

    const { data: inactiveServices } = await admin
        .from('services')
        .select('id')
        .eq('biz_id', bizId)
        .eq('branch_id', branchId)
        .eq('active', false);

    if (inactiveServices && inactiveServices.length > 0) {
        const serviceIds = inactiveServices.map((service: { id: string }) => service.id);
        const { count: activeBookingsForServices } = await admin
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .in('service_id', serviceIds)
            .neq('status', 'cancelled');

        if ((activeBookingsForServices ?? 0) > 0) {
            return {
                ok: false,
                statusCode: 400,
                errorType: 'conflict',
                message:
                    'Невозможно удалить филиал: у неактивных услуг есть активные брони. Сначала отмените все активные брони.',
            };
        }

        const { error: deleteCancelledBookingsError } = await admin
            .from('bookings')
            .delete()
            .in('service_id', serviceIds)
            .eq('status', 'cancelled');

        if (deleteCancelledBookingsError) {
            return {
                ok: false,
                statusCode: 400,
                errorType: 'internal',
                message: `Не удалось удалить отмененные брони: ${deleteCancelledBookingsError.message}`,
            };
        }

        const { error: deleteInactiveServicesError } = await admin
            .from('services')
            .delete()
            .eq('biz_id', bizId)
            .eq('branch_id', branchId)
            .eq('active', false);

        if (deleteInactiveServicesError) {
            return {
                ok: false,
                statusCode: 400,
                errorType: 'internal',
                message: `Не удалось удалить неактивные услуги: ${deleteInactiveServicesError.message}`,
            };
        }
    }

    const { error: deleteBranchError } = await admin
        .from('branches')
        .delete()
        .eq('id', branchId)
        .eq('biz_id', bizId);

    if (!deleteBranchError) {
        return { ok: true };
    }

    const errorMsg = deleteBranchError.message.toLowerCase();
    if (errorMsg.includes('foreign key') && errorMsg.includes('staff')) {
        const { data: inactiveStaff } = await admin
            .from('staff')
            .select('id')
            .eq('biz_id', bizId)
            .eq('branch_id', branchId)
            .eq('is_active', false);

        if (inactiveStaff && inactiveStaff.length > 0) {
            if (otherBranch) {
                const { error: moveAgainError } = await admin
                    .from('staff')
                    .update({ branch_id: otherBranch.id })
                    .eq('biz_id', bizId)
                    .eq('branch_id', branchId)
                    .eq('is_active', false);

                if (!moveAgainError) {
                    const { error: deleteRetryError } = await admin
                        .from('branches')
                        .delete()
                        .eq('id', branchId)
                        .eq('biz_id', bizId);

                    if (!deleteRetryError) {
                        return { ok: true };
                    }

                    return {
                        ok: false,
                        statusCode: 400,
                        errorType: 'internal',
                        message: deleteRetryError.message,
                    };
                }
            }

            return {
                ok: false,
                statusCode: 400,
                errorType: 'conflict',
                message:
                    'Невозможно удалить филиал: к нему привязаны неактивные сотрудники, а других филиалов нет. Создайте другой филиал или удалите неактивных сотрудников.',
            };
        }
    }

    return {
        ok: false,
        statusCode: 400,
        errorType: 'internal',
        message: deleteBranchError.message,
    };
}

