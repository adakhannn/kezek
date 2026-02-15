export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { coordsToEWKT, validateLatLon } from '@/lib/validation';

type Body = {
    name: string;
    address?: string | null;
    is_active: boolean;
    lat?: number | null;
    lon?: number | null;
};

export async function POST(req: Request, context: unknown) {
    return withErrorHandler('BranchesUpdate', async () => {
        const branchId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = await req.json().catch(() => ({} as Body));
        if (!body.name?.trim()) {
            return createErrorResponse('validation', 'Имя обязательно', undefined, 400);
        }

        // проверим, что филиал принадлежит этому бизнесу (используем унифицированную утилиту)
        const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
            admin,
            'branches',
            branchId,
            bizId,
            'id, biz_id'
        );
        if (branchCheck.error || !branchCheck.data) {
            if (branchCheck.error === 'Resource not found') {
                return createErrorResponse('not_found', 'Филиал не найден', undefined, 404);
            }
            return createErrorResponse('forbidden', 'Филиал не принадлежит этому бизнесу', { currentBizId: bizId }, 403);
        }

        const updateData: {
            name: string;
            address: string | null;
            is_active: boolean;
            coords?: string | null;
        } = {
            name: body.name.trim(),
            address: body.address ?? null,
            is_active: !!body.is_active,
        };

        // Координаты: меняем ТОЛЬКО coords; lat/lon не трогаем (их пересчитает БД)
        if ('lat' in body || 'lon' in body) {
            if (body.lat != null && body.lon != null) {
                const v = validateLatLon(body.lat, body.lon);
                if (!v.ok) {
                    return createErrorResponse('validation', 'Некорректные координаты', undefined, 400);
                }
                updateData.coords = coordsToEWKT(v.lat, v.lon);
            } else {
                updateData.coords = null;
            }
        }

        const { error: eUpd } = await admin
            .from('branches')
            .update(updateData)
            .eq('id', branchId)
            .eq('biz_id', bizId);

        if (eUpd) {
            return createErrorResponse('validation', eUpd.message, undefined, 400);
        }

        return createSuccessResponse();
    });
}
