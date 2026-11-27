import { resolveBusinessTimeZone } from '@shared-client/timezone';
import { formatInTimeZone } from 'date-fns-tz';

import { reportDatabaseError } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import type { DbTableClient } from '@/lib/supabaseTypes';

export type VisitPackagesListQuery = {
  clientId?: string;
  branchId?: string;
  status?: 'active' | 'expired' | 'all';
};

export type SellVisitPackageBody = {
  plan_id: string;
};

type ClientVisitPackageRow = {
  id: string;
  client_id: string;
  plan_id: string;
  remaining_visits: number;
  valid_until: string;
  purchased_at: string;
  created_at: string;
};

const SOLD_PACKAGE_COLUMNS = 'id, client_id, plan_id, remaining_visits, valid_until, purchased_at, created_at';

/**
 * Today in the business's own time zone (API-11): a package's term and expiry follow the
 * business calendar, not UTC (in Bishkek the UTC date is yesterday until 06:00).
 */
async function businessToday(admin: VisitPackagesAdminLike, bizId: string, now: Date): Promise<string> {
  try {
    const { data } = await admin.from('businesses').select('tz').eq('id', bizId).maybeSingle();
    return formatInTimeZone(now, resolveBusinessTimeZone(data?.tz), 'yyyy-MM-dd');
  } catch {
    // A failed lookup must not block a sale: the platform's home time zone is the default.
    return formatInTimeZone(now, resolveBusinessTimeZone(null), 'yyyy-MM-dd');
  }
}

/** Calendar arithmetic on a YYYY-MM-DD date, independent of the server's time zone. */
function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function soldPackage(row: ClientVisitPackageRow) {
  return {
    id: row.id,
    client_id: row.client_id,
    plan_id: row.plan_id,
    remaining_visits: row.remaining_visits,
    valid_until: row.valid_until,
    purchased_at: row.purchased_at,
    created_at: row.created_at,
  };
}

export type VisitPackagesAdminLike = DbTableClient;

export type VisitPackagesResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: 'validation' | 'not_found' | 'server' | 'conflict';
      message: string;
      status: number;
      details?: string;
    };

export async function listVisitPackages(params: {
  admin: VisitPackagesAdminLike;
  bizId: string;
  query: VisitPackagesListQuery;
  today?: string;
}): Promise<
  VisitPackagesResult<{
    packages: Array<{
      id: string;
      client_id: string;
      client_name: string | null;
      plan_id: string;
      remaining_visits: number;
      valid_until: string;
      purchased_at: string;
      created_at: string;
      plan_name_ru: string | null;
      plan_name_ky: string | null;
      plan_name_en: string | null;
      plan_visit_count: number | null;
    }>;
  }>
> {
  const today = params.today ?? (await businessToday(params.admin, params.bizId, new Date()));
  const { data: planRows, error: planError } = await params.admin
    .from('visit_package_plans')
    .select('id, name_ru, name_ky, name_en, visit_count, branch_ids')
    .eq('biz_id', params.bizId);

  if (planError) {
    return {
      ok: false,
      error: 'server',
      message: reportDatabaseError('VisitPackages', planError, 'Failed to load visit packages'),
      status: 500,
    };
  }

  const planIds = (planRows ?? []).map((plan) => plan.id);
  if (planIds.length === 0) {
    return {
      ok: true,
      data: { packages: [] },
    };
  }

  let packagesQuery = params.admin
    .from('client_visit_packages')
    .select('id, client_id, plan_id, remaining_visits, valid_until, purchased_at, created_at')
    .in('plan_id', planIds)
    .order('purchased_at', { ascending: false });

  if (params.query.clientId) {
    packagesQuery = packagesQuery.eq('client_id', params.query.clientId);
  }

  let packagesResult:
    | { data: ClientVisitPackageRow[] | null; error: { message: string } | null }
    | undefined;
  if (params.query.status === 'active') {
    packagesResult = await packagesQuery.gte('valid_until', today).gt('remaining_visits', 0);
  } else if (params.query.status === 'expired') {
    packagesResult = await packagesQuery.or(`valid_until.lt.${today},remaining_visits.eq.0`);
  } else {
    packagesResult = await packagesQuery;
  }

  if (packagesResult.error) {
    return {
      ok: false,
      error: 'server',
      message: 'Failed to load visit packages',
      details: packagesResult.error.message,
      status: 500,
    };
  }

  const planMap = new Map((planRows ?? []).map((plan) => [plan.id, plan] as const));
  const clientIds = [...new Set((packagesResult.data ?? []).map((row) => row.client_id))];

  const profileResult =
    clientIds.length > 0
      ? await params.admin
          .from('profiles')
          .select('id, full_name')
          .in('id', clientIds)
      : {
          data: [] as Array<{ id: string; full_name: string | null }>,
          error: null,
        };

  if (profileResult.error) {
    return {
      ok: false,
      error: 'server',
      message: 'Failed to load visit packages',
      details: profileResult.error.message,
      status: 500,
    };
  }

  const nameByClientId = (profileResult.data ?? []).reduce<Record<string, string>>((acc, profile) => {
    if (profile.full_name) {
      acc[profile.id] = profile.full_name;
    }
    return acc;
  }, {});

  let packages = (packagesResult.data ?? []).map((row) => {
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

  if (params.query.branchId) {
    packages = packages.filter(
      (item) =>
        !item.plan_branch_ids ||
        item.plan_branch_ids.length === 0 ||
        item.plan_branch_ids.includes(params.query.branchId as string),
    );
  }

  return {
    ok: true,
    data: {
      packages: packages.map(({ plan_branch_ids: _, ...rest }) => rest),
    },
  };
}

export async function sellVisitPackage(params: {
  admin: VisitPackagesAdminLike;
  bizId: string;
  clientId: string;
  body: SellVisitPackageBody;
  /** Idempotency-Key of the sale attempt (API-11): a retry returns the package already sold. */
  requestId?: string | null;
  now?: Date;
}): Promise<
  VisitPackagesResult<{
    /** True when this request was already served: the package is the one sold before. */
    replayed?: boolean;
    package: {
      id: string;
      client_id: string;
      plan_id: string;
      remaining_visits: number;
      valid_until: string;
      purchased_at: string;
      created_at: string;
    };
  }>
> {
  const { data: plan, error: planError } = await params.admin
    .from('visit_package_plans')
    .select('id, biz_id, visit_count, validity_days, is_active')
    .eq('id', params.body.plan_id)
    .eq('biz_id', params.bizId)
    .maybeSingle();

  if (planError || !plan) {
    return {
      ok: false,
      error: 'not_found',
      message: 'План пакета не найден или недоступен',
      status: 404,
    };
  }

  if (!plan.is_active) {
    return {
      ok: false,
      error: 'validation',
      message: 'План пакета деактивирован',
      status: 400,
    };
  }

  const now = params.now ?? new Date();
  const today = await businessToday(params.admin, params.bizId, now);
  const validUntilDate = addDays(today, plan.validity_days);

  const { data: sold, error: insertError } = await params.admin
    .from('client_visit_packages')
    .insert({
      client_id: params.clientId,
      plan_id: plan.id,
      remaining_visits: plan.visit_count,
      valid_until: validUntilDate,
      purchased_at: now.toISOString(),
      ...(params.requestId ? { request_id: params.requestId } : {}),
    })
    .select(SOLD_PACKAGE_COLUMNS)
    .single();

  // The same sale request again (double click, retry after a lost answer): return what it sold.
  if (insertError?.code === '23505' && params.requestId) {
    const { data: existing } = await params.admin
      .from('client_visit_packages')
      .select(SOLD_PACKAGE_COLUMNS)
      .eq('request_id', params.requestId)
      .maybeSingle();
    if (existing && existing.client_id === params.clientId && existing.plan_id === plan.id) {
      return { ok: true, data: { replayed: true, package: soldPackage(existing) } };
    }
    return {
      ok: false,
      error: 'conflict',
      message: 'Этот запрос уже оформил другую продажу. Обновите страницу и повторите.',
      status: 409,
    };
  }

  if (insertError || !sold) {
    logError('VisitPackages', 'Visit package sale failed', insertError ?? { message: 'no row returned' });
    return {
      ok: false,
      error: 'server',
      message: 'Не удалось оформить пакет',
      status: 500,
    };
  }

  return {
    ok: true,
    data: {
      package: soldPackage(sold),
    },
  };
}
