/**
 * POST /api/dashboard/clients/[clientId]/visit-packages — продажа пакета клиенту
 */

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getRouteParamUuid } from '@/lib/routeParams';
import { validateRequest } from '@/lib/validation/apiValidation';
import { sellVisitPackageSchema } from '@/lib/validation/schemas';
import { withManagerContext } from '@/lib/withManagerContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ clientId: string }> }) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('SellVisitPackage', async () => {
      const clientId = await getRouteParamUuid(context, 'clientId');
      const validationResult = await validateRequest(req, sellVisitPackageSchema);
      if (!validationResult.success) return validationResult.response;

      return withManagerContext(req, 'SellVisitPackage', async ({ admin, bizId }) => {
        const planId = validationResult.data.plan_id;

        const { data: plan, error: planError } = await admin
          .from('visit_package_plans')
          .select('id, biz_id, visit_count, validity_days, is_active')
          .eq('id', planId)
          .eq('biz_id', bizId)
          .maybeSingle();

        if (planError || !plan) {
          return createErrorResponse('not_found', 'План пакета не найден или недоступен', undefined, 404);
        }
        if (!plan.is_active) {
          return createErrorResponse('validation', 'План пакета деактивирован', undefined, 400);
        }

        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + plan.validity_days);
        const validUntilDate = validUntil.toISOString().slice(0, 10);

        const { data: sold, error: insertError } = await admin
          .from('client_visit_packages')
          .insert({
            client_id: clientId,
            plan_id: planId,
            remaining_visits: plan.visit_count,
            valid_until: validUntilDate,
            purchased_at: new Date().toISOString(),
          })
          .select('id, client_id, plan_id, remaining_visits, valid_until, purchased_at, created_at')
          .single();

        if (insertError) {
          return createErrorResponse('server', 'Не удалось оформить пакет', insertError.message, 500);
        }

        return createSuccessResponse({
          package: {
            id: sold.id,
            client_id: sold.client_id,
            plan_id: sold.plan_id,
            remaining_visits: sold.remaining_visits,
            valid_until: sold.valid_until,
            purchased_at: sold.purchased_at,
            created_at: sold.created_at,
          },
        });
      });
    })
  );
}
