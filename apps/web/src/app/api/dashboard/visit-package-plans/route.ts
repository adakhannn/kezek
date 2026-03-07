/**
 * GET /api/dashboard/visit-package-plans — список типов пакетов бизнеса
 * POST /api/dashboard/visit-package-plans — создание типа пакета
 */

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { validateRequest } from '@/lib/validation/apiValidation';
import { visitPackagePlanSchema } from '@/lib/validation/schemas';
import { withManagerContext } from '@/lib/withManagerContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  return withErrorHandler('VisitPackagePlansList', async () => {
    return withManagerContext(req, 'VisitPackagePlansList', async ({ admin, bizId }) => {
      const { data, error } = await admin
        .from('visit_package_plans')
        .select('*')
        .eq('biz_id', bizId)
        .order('created_at', { ascending: false });

      if (error) {
        return createErrorResponse('server', 'Failed to load visit package plans', error.message, 500);
      }

      const plans = (data ?? []).map((row) => ({
        id: row.id,
        biz_id: row.biz_id,
        name_ru: row.name_ru,
        name_ky: row.name_ky ?? null,
        name_en: row.name_en ?? null,
        visit_count: row.visit_count,
        validity_days: row.validity_days,
        discount_type: row.discount_type,
        discount_value: Number(row.discount_value),
        service_id: row.service_id ?? null,
        branch_ids: row.branch_ids ?? null,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      return createSuccessResponse({ plans });
    });
  });
}

export async function POST(req: Request) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('VisitPackagePlansCreate', async () => {
      const validationResult = await validateRequest(req, visitPackagePlanSchema);
      if (!validationResult.success) return validationResult.response;

      return withManagerContext(req, 'VisitPackagePlansCreate', async ({ admin, bizId }) => {
        const body = validationResult.data;
        const { data, error } = await admin
          .from('visit_package_plans')
          .insert({
            biz_id: bizId,
            name_ru: body.name_ru,
            name_ky: body.name_ky ?? null,
            name_en: body.name_en ?? null,
            visit_count: body.visit_count,
            validity_days: body.validity_days,
            discount_type: body.discount_type,
            discount_value: body.discount_value,
            service_id: body.service_id ?? null,
            branch_ids: body.branch_ids ?? null,
            is_active: true,
          })
          .select('id, name_ru, visit_count, validity_days, discount_type, discount_value, is_active, created_at')
          .single();

        if (error) {
          return createErrorResponse('server', 'Failed to create visit package plan', error.message, 500);
        }

        return createSuccessResponse({
          plan: {
            id: data.id,
            name_ru: data.name_ru,
            visit_count: data.visit_count,
            validity_days: data.validity_days,
            discount_type: data.discount_type,
            discount_value: Number(data.discount_value),
            is_active: data.is_active,
            created_at: data.created_at,
          },
        });
      });
    })
  );
}
