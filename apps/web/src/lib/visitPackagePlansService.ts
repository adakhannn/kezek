export type VisitPackagePlanRow = {
  id: string;
  biz_id: string;
  name_ru: string;
  name_ky: string | null;
  name_en: string | null;
  visit_count: number;
  validity_days: number;
  discount_type: 'percent' | 'fixed_price';
  discount_value: number | string;
  service_id: string | null;
  branch_ids: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VisitPackagePlanCreateBody = {
  name_ru: string;
  name_ky?: string | null;
  name_en?: string | null;
  visit_count: number;
  validity_days: number;
  discount_type: 'percent' | 'fixed_price';
  discount_value: number;
  service_id?: string | null;
  branch_ids?: string[] | null;
};

export type VisitPackagePlanPatchBody = Partial<VisitPackagePlanCreateBody> & {
  is_active?: boolean;
};

export type VisitPackagePlansAdminLike = {
  from: (table: string) => {
    select?: (...args: unknown[]) => unknown;
    insert?: (...args: unknown[]) => unknown;
    update?: (...args: unknown[]) => unknown;
  };
};

export type VisitPackagePlansResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: 'server' | 'not_found';
      message: string;
      status: number;
      details?: string;
    };

function mapVisitPackagePlan(row: VisitPackagePlanRow) {
  return {
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
  };
}

function buildVisitPackagePlanUpdate(body: VisitPackagePlanPatchBody) {
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

  return update;
}

async function ensureVisitPackagePlanBelongsToBiz(params: {
  admin: VisitPackagePlansAdminLike;
  planId: string;
  bizId: string;
}) {
  const lookupQuery = params.admin.from('visit_package_plans') as {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        maybeSingle: () => Promise<{
          data: { id: string; biz_id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data, error } = await lookupQuery
    .select('id, biz_id')
    .eq('id', params.planId)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      error: 'server' as const,
      message: 'Failed to load visit package plan',
      details: error.message,
      status: 500,
    };
  }

  if (!data || data.biz_id !== params.bizId) {
    return {
      ok: false as const,
      error: 'not_found' as const,
      message: 'План пакета не найден или доступ запрещён',
      status: 404,
    };
  }

  return { ok: true as const };
}

export async function listVisitPackagePlans(params: {
  admin: VisitPackagePlansAdminLike;
  bizId: string;
}): Promise<VisitPackagePlansResult<{ plans: ReturnType<typeof mapVisitPackagePlan>[] }>> {
  const query = params.admin.from('visit_package_plans') as {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        order: (...args: unknown[]) => Promise<{
          data: VisitPackagePlanRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data, error } = await query
    .select('*')
    .eq('biz_id', params.bizId)
    .order('created_at', { ascending: false });

  if (error) {
    return {
      ok: false,
      error: 'server',
      message: 'Failed to load visit package plans',
      details: error.message,
      status: 500,
    };
  }

  return {
    ok: true,
    data: {
      plans: (data ?? []).map(mapVisitPackagePlan),
    },
  };
}

export async function createVisitPackagePlan(params: {
  admin: VisitPackagePlansAdminLike;
  bizId: string;
  body: VisitPackagePlanCreateBody;
}): Promise<
  VisitPackagePlansResult<{
    plan: {
      id: string;
      name_ru: string;
      visit_count: number;
      validity_days: number;
      discount_type: 'percent' | 'fixed_price';
      discount_value: number;
      is_active: boolean;
      created_at: string;
    };
  }>
> {
  const query = params.admin.from('visit_package_plans') as {
    insert: (...args: unknown[]) => {
      select: (...args: unknown[]) => {
        single: () => Promise<{
          data: {
            id: string;
            name_ru: string;
            visit_count: number;
            validity_days: number;
            discount_type: 'percent' | 'fixed_price';
            discount_value: number | string;
            is_active: boolean;
            created_at: string;
          } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data, error } = await query
    .insert({
      biz_id: params.bizId,
      name_ru: params.body.name_ru,
      name_ky: params.body.name_ky ?? null,
      name_en: params.body.name_en ?? null,
      visit_count: params.body.visit_count,
      validity_days: params.body.validity_days,
      discount_type: params.body.discount_type,
      discount_value: params.body.discount_value,
      service_id: params.body.service_id ?? null,
      branch_ids: params.body.branch_ids ?? null,
      is_active: true,
    })
    .select('id, name_ru, visit_count, validity_days, discount_type, discount_value, is_active, created_at')
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: 'server',
      message: 'Failed to create visit package plan',
      details: error?.message,
      status: 500,
    };
  }

  return {
    ok: true,
    data: {
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
    },
  };
}

export async function updateVisitPackagePlan(params: {
  admin: VisitPackagePlansAdminLike;
  planId: string;
  bizId: string;
  body: VisitPackagePlanPatchBody;
}): Promise<
  VisitPackagePlansResult<
    | { plan_id: string; updated: false }
    | {
        plan: {
          id: string;
          name_ru: string;
          is_active: boolean;
          updated_at: string;
        };
      }
  >
> {
  const ownership = await ensureVisitPackagePlanBelongsToBiz(params);
  if (!ownership.ok) {
    return ownership;
  }

  const update = buildVisitPackagePlanUpdate(params.body);
  if (Object.keys(update).length === 0) {
    return {
      ok: true,
      data: {
        plan_id: params.planId,
        updated: false,
      },
    };
  }

  const query = params.admin.from('visit_package_plans') as {
    update: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        eq: (...args: unknown[]) => {
          select: (...args: unknown[]) => {
            single: () => Promise<{
              data: {
                id: string;
                name_ru: string;
                is_active: boolean;
                updated_at: string;
              } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };

  const { data, error } = await query
    .update(update)
    .eq('id', params.planId)
    .eq('biz_id', params.bizId)
    .select('id, name_ru, is_active, updated_at')
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: 'server',
      message: 'Failed to update visit package plan',
      details: error?.message,
      status: 500,
    };
  }

  return {
    ok: true,
    data: {
      plan: {
        id: data.id,
        name_ru: data.name_ru,
        is_active: data.is_active,
        updated_at: data.updated_at,
      },
    },
  };
}
