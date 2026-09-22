export type ServiceCreateBody = {
  name_ru: string;
  name_ky?: string | null;
  name_en?: string | null;
  duration_min: number;
  price_from: number;
  price_to: number;
  active?: boolean;
  branch_ids?: string[];
  branch_id?: string | null;
};

export type ServiceCreateAdminLike = {
  from: (table: string) => {
    select?: (...args: unknown[]) => unknown;
    insert?: (...args: unknown[]) => unknown;
  };
};

export type ServiceCreateResult =
  | { ok: true; data: { count: number; ids: string[] } }
  | {
      ok: false;
      error: 'validation';
      message: string;
      status: number;
      details?: Record<string, unknown>;
    };

export async function createServiceRouteEntry(params: {
  admin: ServiceCreateAdminLike;
  bizId: string;
  body: ServiceCreateBody;
}): Promise<ServiceCreateResult> {
  const { admin, bizId, body } = params;

  const name = (body.name_ru ?? '').trim();
  if (!name) {
    return {
      ok: false,
      error: 'validation',
      message: 'Название услуги обязательно',
      status: 400,
    };
  }

  const duration = Number(body.duration_min);
  if (!Number.isInteger(duration) || duration < 1) {
    return {
      ok: false,
      error: 'validation',
      message: 'Длительность должна быть больше 0',
      status: 400,
    };
  }

  const price_from = Number(body.price_from);
  const price_to = Number(body.price_to);
  if (!Number.isFinite(price_from) || !Number.isFinite(price_to) || price_from < 0 || price_to < 0) {
    return {
      ok: false,
      error: 'validation',
      message: 'Цена не может быть отрицательной',
      status: 400,
    };
  }
  if (price_to && price_from && price_to < price_from) {
    return {
      ok: false,
      error: 'validation',
      message: 'Максимальная цена не может быть меньше минимальной',
      status: 400,
    };
  }

  let branchIds = Array.isArray(body.branch_ids) ? body.branch_ids.filter(Boolean) : [];
  if (!branchIds.length && body.branch_id) {
    branchIds = [body.branch_id];
  }
  branchIds = Array.from(new Set(branchIds));

  if (branchIds.length === 0) {
    return {
      ok: false,
      error: 'validation',
      message: 'Необходимо указать хотя бы один филиал',
      status: 400,
    };
  }

  if (branchIds.length > 100) {
    return {
      ok: false,
      error: 'validation',
      message: 'Слишком много филиалов (максимум 100)',
      status: 400,
    };
  }

  const branchesQuery = admin.from('branches') as {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        in: (...args: unknown[]) => Promise<{
          data: Array<{ id: string }> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data: brRows, error: brErr } = await branchesQuery
    .select('id')
    .eq('biz_id', bizId)
    .in('id', branchIds);

  if (brErr) {
    return {
      ok: false,
      error: 'validation',
      message: brErr.message,
      status: 400,
    };
  }

  const found = new Set((brRows ?? []).map((r) => String(r.id)));
  const missing = branchIds.filter((id) => !found.has(String(id)));
  if (missing.length) {
    return {
      ok: false,
      error: 'validation',
      message: 'Некоторые филиалы не принадлежат этому бизнесу',
      details: { missing },
      status: 400,
    };
  }

  const active = body.active ?? true;
  const name_ky = body.name_ky?.trim() || null;
  const name_en = body.name_en?.trim() || null;
  const rows = branchIds.map((branch_id) => ({
    biz_id: bizId,
    branch_id,
    name_ru: name,
    name_ky,
    name_en,
    duration_min: duration,
    price_from,
    price_to,
    active,
  }));

  const servicesQuery = admin.from('services') as {
    insert: (...args: unknown[]) => {
      select: (...args: unknown[]) => Promise<{
        data: Array<{ id: string; branch_id: string }> | null;
        error: { message: string } | null;
      }>;
    };
  };

  const { data: inserted, error: insErr } = await servicesQuery
    .insert(rows)
    .select('id, branch_id');

  if (insErr) {
    return {
      ok: false,
      error: 'validation',
      message: insErr.message,
      status: 400,
    };
  }

  return {
    ok: true,
    data: {
      count: inserted?.length ?? 0,
      ids: (inserted ?? []).map((r) => r.id),
    },
  };
}
