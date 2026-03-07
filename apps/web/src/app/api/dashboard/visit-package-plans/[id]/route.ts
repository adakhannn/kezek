/**
 * PATCH /api/dashboard/visit-package-plans/[id] — редактирование и деактивация типа пакета
 */

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getRouteParamUuid } from '@/lib/routeParams';
import { validateRequest } from '@/lib/validation/apiValidation';
import { visitPackagePlanPatchSchema } from '@/lib/validation/schemas';
import { withManagerContext } from '@/lib/withManagerContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('VisitPackagePlanPatch', async () => {
      const planId = await getRouteParamUuid(context, 'id');
      const validationResult = await validateRequest(req, visitPackagePlanPatchSchema);
      if (!validationResult.success) return validationResult.response;

      return withManagerContext(req, 'VisitPackagePlanPatch', async ({ admin, bizId }) => {
        const belongs = await checkResourceBelongsToBiz(admin, 'visit_package_plans', planId, bizId);
        if (belongs.error || !belongs.data) {
          return createErrorResponse('not_found', 'План пакета не найден или доступ запрещён', undefined, 404);
        }

        const body = validationResult.data;
        const update: Record<string, unknown> = {};
        if (body.name_ru !== undefined) update.name_ru = body.name_ru;
        if (body.name_ky !== undefined) update.name_ky = body.name_ky;
        if (body.name_en !== undefined) update.name_en = body.name_en;
        if (body.visit_count !== undefined) update.visit_count = body.visit_count;
        if (body.validity_days !== undefined) update.validity_days = body.validity_days;
        if (body.discount_type !== undefined) update.discount_type = body.discount_type;
        if (body.discount_value !== undefined) update.discount_value = body.discount_value;
        if (body.service_id !== undefined) update.service_id = body.service_id;
        if (body.branch_ids !== undefined) update.branch_ids = body.branch_ids;
        if (body.is_active !== undefined) update.is_active = body.is_active;

        if (Object.keys(update).length === 0) {
          return createSuccessResponse({ plan_id: planId, updated: false });
        }

        const { data, error } = await admin
          .from('visit_package_plans')
          .update(update)
          .eq('id', planId)
          .eq('biz_id', bizId)
          .select('id, name_ru, is_active, updated_at')
          .single();

        if (error) {
          return createErrorResponse('server', 'Failed to update visit package plan', error.message, 500);
        }

        return createSuccessResponse({
          plan: {
            id: data.id,
            name_ru: data.name_ru,
            is_active: data.is_active,
            updated_at: data.updated_at,
          },
        });
      });
    })
  );
}
