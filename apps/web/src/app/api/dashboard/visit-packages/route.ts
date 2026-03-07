/**
 * GET /api/dashboard/visit-packages — список проданных пакетов с фильтрами
 */

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { validateQuery } from '@/lib/validation/apiValidation';
import { visitPackagesListQuerySchema } from '@/lib/validation/schemas';
import { withManagerContext } from '@/lib/withManagerContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  return withErrorHandler('VisitPackagesList', async () => {
    const url = new URL(req.url);
    const queryResult = validateQuery(url, visitPackagesListQuerySchema);
    if (!queryResult.success) return queryResult.response;

    return withManagerContext(req, 'VisitPackagesList', async ({ admin, bizId }) => {
      const { clientId, branchId, status } = queryResult.data;
      const today = new Date().toISOString().slice(0, 10);

      const { data: planRows } = await admin
        .from('visit_package_plans')
        .select('id, name_ru, name_ky, name_en, visit_count, branch_ids')
        .eq('biz_id', bizId);

      const planIds = (planRows ?? []).map((p: { id: string }) => p.id);
      if (planIds.length === 0) {
        return createSuccessResponse({ packages: [] });
      }

      let query = admin
        .from('client_visit_packages')
        .select('id, client_id, plan_id, remaining_visits, valid_until, purchased_at, created_at')
        .in('plan_id', planIds)
        .order('purchased_at', { ascending: false });

      if (clientId) query = query.eq('client_id', clientId);
      if (status === 'active') {
        query = query.gte('valid_until', today).gt('remaining_visits', 0);
      } else if (status === 'expired') {
        query = query.or(`valid_until.lt.${today},remaining_visits.eq.0`);
      }

      const { data: rows, error } = await query;
      if (error) {
        return createErrorResponse('server', 'Failed to load visit packages', error.message, 500);
      }

      type PlanRow = { id: string; name_ru: string; name_ky: string | null; name_en: string | null; visit_count: number; branch_ids: string[] | null };
      const planMap = new Map(((planRows ?? []) as PlanRow[]).map((p) => [p.id, p] as const));

      type PackageRow = { id: string; client_id: string; plan_id: string; remaining_visits: number; valid_until: string; purchased_at: string; created_at: string };
      const clientIds = [...new Set((rows ?? []).map((r: PackageRow) => r.client_id))];
      const { data: profiles } =
        clientIds.length > 0
          ? await admin.from('profiles').select('id, full_name').in('id', clientIds)
          : { data: [] };
      const nameByClientId = (profiles ?? []).reduce<Record<string, string>>((acc, p) => {
        if (p.full_name) acc[p.id] = p.full_name;
        return acc;
      }, {});

      type PackageOut = { id: string; client_id: string; client_name: string | null; plan_id: string; remaining_visits: number; valid_until: string; purchased_at: string; created_at: string; plan_name_ru: string | null; plan_name_ky: string | null; plan_name_en: string | null; plan_visit_count: number | null };
      let list: Array<PackageOut & { plan_branch_ids: string[] | null }> = (rows ?? []).map((row: PackageRow) => {
        const plan = planMap.get(row.plan_id);
        return {
          id: row.id,
          client_id: row.client_id,
          client_name: nameByClientId[row.client_id] ?? null,
          plan_id: row.plan_id,
          remaining_visits: row.remaining_visits,
          valid_until: row.valid_until,
          purchased_at: row.purchased_at,
          created_at: row.created_at,
          plan_name_ru: plan?.name_ru ?? null,
          plan_name_ky: plan?.name_ky ?? null,
          plan_name_en: plan?.name_en ?? null,
          plan_visit_count: plan?.visit_count ?? null,
          plan_branch_ids: plan?.branch_ids ?? null,
        };
      });

      if (branchId && list.length > 0) {
        list = list.filter((p) => !p.plan_branch_ids || p.plan_branch_ids.length === 0 || p.plan_branch_ids.includes(branchId));
      }

      const packages: PackageOut[] = list.map(({ plan_branch_ids: _, ...rest }) => rest);
      return createSuccessResponse({ packages });
    });
  });
}
