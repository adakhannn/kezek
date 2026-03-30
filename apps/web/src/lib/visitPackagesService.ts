export type VisitPackagesListQuery = {
  clientId?: string;
  branchId?: string;
  status?: 'active' | 'expired' | 'all';
};

export type SellVisitPackageBody = {
  plan_id: string;
};

type VisitPackagePlanListRow = {
  id: string;
  name_ru: string;
  name_ky: string | null;
  name_en: string | null;
  visit_count: number;
  branch_ids: string[] | null;
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

type VisitPackagePlanSaleRow = {
  id: string;
  biz_id: string;
  visit_count: number;
  validity_days: number;
  is_active: boolean;
};

export type VisitPackagesAdminLike = {
  from: (table: string) => {
    select?: (...args: unknown[]) => unknown;
    insert?: (...args: unknown[]) => unknown;
  };
};

export type VisitPackagesResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: 'validation' | 'not_found' | 'server';
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
  const today = params.today ?? new Date().toISOString().slice(0, 10);
  const planQuery = params.admin.from('visit_package_plans') as {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => Promise<{
        data: VisitPackagePlanListRow[] | null;
        error: { message: string } | null;
      }>;
    };
  };

  const { data: planRows, error: planError } = await planQuery
    .select('id, name_ru, name_ky, name_en, visit_count, branch_ids')
    .eq('biz_id', params.bizId);

  if (planError) {
    return {
      ok: false,
      error: 'server',
      message: 'Failed to load visit packages',
      details: planError.message,
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

  let packagesQuery = (params.admin.from('client_visit_packages') as {
    select: (...args: unknown[]) => {
      in: (...args: unknown[]) => {
        order: (...args: unknown[]) => unknown;
      };
    };
  })
    .select('id, client_id, plan_id, remaining_visits, valid_until, purchased_at, created_at')
    .in('plan_id', planIds)
    .order('purchased_at', { ascending: false }) as {
    eq: (...args: unknown[]) => typeof packagesQuery;
    gte: (...args: unknown[]) => typeof packagesQuery;
    gt: (...args: unknown[]) => Promise<{ data: ClientVisitPackageRow[] | null; error: { message: string } | null }>;
    or: (...args: unknown[]) => Promise<{ data: ClientVisitPackageRow[] | null; error: { message: string } | null }>;
  } & PromiseLike<{ data: ClientVisitPackageRow[] | null; error: { message: string } | null }>;

  if (params.query.clientId) {
    packagesQuery = packagesQuery.eq('client_id', params.query.clientId) as typeof packagesQuery;
  }

  let packagesResult:
    | { data: ClientVisitPackageRow[] | null; error: { message: string } | null }
    | undefined;
  if (params.query.status === 'active') {
    packagesResult = await packagesQuery.gte('valid_until', today).gt('remaining_visits', 0);
  } else if (params.query.status === 'expired') {
    packagesResult = await packagesQuery.or(`valid_until.lt.${today},remaining_visits.eq.0`);
  } else {
    packagesResult = await (packagesQuery as unknown as Promise<{
      data: ClientVisitPackageRow[] | null;
      error: { message: string } | null;
    }>);
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
      ? await ((params.admin.from('profiles') as {
          select: (...args: unknown[]) => {
            in: (...args: unknown[]) => Promise<{
              data: Array<{ id: string; full_name: string | null }> | null;
              error: { message: string } | null;
            }>;
          };
        })
          .select('id, full_name')
          .in('id', clientIds))
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
  now?: Date;
}): Promise<
  VisitPackagesResult<{
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
  const planLookup = params.admin.from('visit_package_plans') as {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        eq: (...args: unknown[]) => {
          maybeSingle: () => Promise<{
            data: VisitPackagePlanSaleRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data: plan, error: planError } = await planLookup
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
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + plan.validity_days);
  const validUntilDate = validUntil.toISOString().slice(0, 10);

  const insertQuery = params.admin.from('client_visit_packages') as {
    insert: (...args: unknown[]) => {
      select: (...args: unknown[]) => {
        single: () => Promise<{
          data: ClientVisitPackageRow | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data: sold, error: insertError } = await insertQuery
    .insert({
      client_id: params.clientId,
      plan_id: params.body.plan_id,
      remaining_visits: plan.visit_count,
      valid_until: validUntilDate,
      purchased_at: now.toISOString(),
    })
    .select('id, client_id, plan_id, remaining_visits, valid_until, purchased_at, created_at')
    .single();

  if (insertError || !sold) {
    return {
      ok: false,
      error: 'server',
      message: 'Не удалось оформить пакет',
      details: insertError?.message,
      status: 500,
    };
  }

  return {
    ok: true,
    data: {
      package: {
        id: sold.id,
        client_id: sold.client_id,
        plan_id: sold.plan_id,
        remaining_visits: sold.remaining_visits,
        valid_until: sold.valid_until,
        purchased_at: sold.purchased_at,
        created_at: sold.created_at,
      },
    },
  };
}
