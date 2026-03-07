/**
 * GET /api/me/visit-packages — пакеты визитов текущего пользователя (кабинет клиента).
 * Только свои пакеты. По умолчанию — только активные (valid_until >= today, remaining_visits > 0).
 * Query: status=all — вернуть все пакеты (для блока «Истёкшие»).
 */

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TODAY = new Date().toISOString().slice(0, 10);

export async function GET(req: Request) {
  return withErrorHandler('MeVisitPackages', async () => {
    const { supabase, admin } = await createSupabaseClients();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    const userId = user.id;
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const includeAll = status === 'all';

    let query = admin
      .from('client_visit_packages')
      .select(
        'id, client_id, plan_id, remaining_visits, valid_until, purchased_at, created_at'
      )
      .eq('client_id', userId)
      .order('valid_until', { ascending: true });

    if (!includeAll) {
      query = query.gte('valid_until', TODAY).gt('remaining_visits', 0);
    }

    const { data: rows, error } = await query;

    if (error) {
      return createErrorResponse(
        'server',
        'Не удалось загрузить пакеты',
        error.message,
        500
      );
    }

    const planIds = [...new Set((rows ?? []).map((r: { plan_id: string }) => r.plan_id))];
    if (planIds.length === 0) {
      return createSuccessResponse({ packages: [] });
    }

    const { data: planRows } = await admin
      .from('visit_package_plans')
      .select('id, name_ru, name_ky, name_en, visit_count')
      .in('id', planIds);

    const planMap = new Map(
      (planRows ?? []).map((p: { id: string; name_ru: string; name_ky: string | null; name_en: string | null; visit_count: number }) => [
        p.id,
        {
          name_ru: p.name_ru,
          name_ky: p.name_ky ?? null,
          name_en: p.name_en ?? null,
          visit_count: p.visit_count,
        },
      ])
    );

    const packages = (rows ?? []).map(
      (r: {
        id: string;
        client_id: string;
        plan_id: string;
        remaining_visits: number;
        valid_until: string;
        purchased_at: string;
        created_at: string;
      }) => {
        const plan = planMap.get(r.plan_id);
        return {
          id: r.id,
          plan_id: r.plan_id,
          plan_name_ru: plan?.name_ru ?? null,
          plan_name_ky: plan?.name_ky ?? null,
          plan_name_en: plan?.name_en ?? null,
          remaining_visits: r.remaining_visits,
          plan_visit_count: plan?.visit_count ?? null,
          valid_until: r.valid_until,
          purchased_at: r.purchased_at,
          created_at: r.created_at,
        };
      }
    );

    return createSuccessResponse({ packages });
  });
}
