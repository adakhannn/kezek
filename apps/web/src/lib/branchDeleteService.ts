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
            message: branchCheck.error || 'Р¤РёР»РёР°Р» РЅРµ РїСЂРёРЅР°РґР»РµР¶РёС‚ СЌС‚РѕРјСѓ Р±РёР·РЅРµСЃСѓ',
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
                'РќРµРІРѕР·РјРѕР¶РЅРѕ СѓРґР°Р»РёС‚СЊ С„РёР»РёР°Р»: Рє РЅРµРјСѓ РїСЂРёРІСЏР·Р°РЅС‹ Р°РєС‚РёРІРЅС‹Рµ СѓСЃР»СѓРіРё. РЎРЅР°С‡Р°Р»Р° СѓРґР°Р»РёС‚Рµ РёР»Рё РїРµСЂРµРјРµСЃС‚РёС‚Рµ РІСЃРµ Р°РєС‚РёРІРЅС‹Рµ СѓСЃР»СѓРіРё.',
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
                'РќРµРІРѕР·РјРѕР¶РЅРѕ СѓРґР°Р»РёС‚СЊ С„РёР»РёР°Р»: Рє РЅРµРјСѓ РїСЂРёРІСЏР·Р°РЅС‹ Р°РєС‚РёРІРЅС‹Рµ СЃРѕС‚СЂСѓРґРЅРёРєРё. РЎРЅР°С‡Р°Р»Р° СѓРґР°Р»РёС‚Рµ РёР»Рё РїРµСЂРµРјРµСЃС‚РёС‚Рµ РІСЃРµС… Р°РєС‚РёРІРЅС‹С… СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ.',
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
                'РќРµРІРѕР·РјРѕР¶РЅРѕ СѓРґР°Р»РёС‚СЊ С„РёР»РёР°Р»: Рє РЅРµРјСѓ РїСЂРёРІСЏР·Р°РЅС‹ Р°РєС‚РёРІРЅС‹Рµ (РЅРµРѕС‚РјРµРЅРµРЅРЅС‹Рµ) Р±СЂРѕРЅРё. РЎРЅР°С‡Р°Р»Р° РѕС‚РјРµРЅРёС‚Рµ РёР»Рё СѓРґР°Р»РёС‚Рµ РІСЃРµ Р°РєС‚РёРІРЅС‹Рµ Р±СЂРѕРЅРё.',
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
            logWarn('BranchDelete', 'РќРµ СѓРґР°Р»РѕСЃСЊ РїРµСЂРµРјРµСЃС‚РёС‚СЊ РЅРµР°РєС‚РёРІРЅС‹С… СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ', moveStaffError);
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
                    'РќРµРІРѕР·РјРѕР¶РЅРѕ СѓРґР°Р»РёС‚СЊ С„РёР»РёР°Р»: Сѓ РЅРµР°РєС‚РёРІРЅС‹С… СѓСЃР»СѓРі РµСЃС‚СЊ Р°РєС‚РёРІРЅС‹Рµ Р±СЂРѕРЅРё. РЎРЅР°С‡Р°Р»Р° РѕС‚РјРµРЅРёС‚Рµ РІСЃРµ Р°РєС‚РёРІРЅС‹Рµ Р±СЂРѕРЅРё.',
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
                message: `РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РѕС‚РјРµРЅРµРЅРЅС‹Рµ Р±СЂРѕРЅРё: ${deleteCancelledBookingsError.message}`,
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
                message: `РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РЅРµР°РєС‚РёРІРЅС‹Рµ СѓСЃР»СѓРіРё: ${deleteInactiveServicesError.message}`,
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
                    'РќРµРІРѕР·РјРѕР¶РЅРѕ СѓРґР°Р»РёС‚СЊ С„РёР»РёР°Р»: Рє РЅРµРјСѓ РїСЂРёРІСЏР·Р°РЅС‹ РЅРµР°РєС‚РёРІРЅС‹Рµ СЃРѕС‚СЂСѓРґРЅРёРєРё, Р° РґСЂСѓРіРёС… С„РёР»РёР°Р»РѕРІ РЅРµС‚. РЎРѕР·РґР°Р№С‚Рµ РґСЂСѓРіРѕР№ С„РёР»РёР°Р» РёР»Рё СѓРґР°Р»РёС‚Рµ РЅРµР°РєС‚РёРІРЅС‹С… СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ.',
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
