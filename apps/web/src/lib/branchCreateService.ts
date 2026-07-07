import { coordsToEWKT, validateLatLon } from '@/lib/validation';

export type BranchCreateBody = {
  name: string;
  address?: string | null;
  is_active?: boolean;
  lat?: number | null;
  lon?: number | null;
};

export type BranchCreateAdminLike = {
  from: (table: string) => {
    insert: (...args: unknown[]) => {
      select: (...args: unknown[]) => {
        single: () => Promise<{
          data: { id?: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

export type BranchCreateResult =
  | { ok: true; data: { id: string | null | undefined } }
  | {
      ok: false;
      error: 'validation' | 'conflict';
      message: string;
      status: number;
    };

export function branchCreateError(error: { message: string }) {
  const match = error.message.match(/BRANCH_LIMIT_REACHED:(\d+):(\d+)/);
  if (match) {
    return {
      error: 'conflict' as const,
      message: `Достигнут лимит филиалов: ${match[1]} из ${match[2]}. Обратитесь к суперадминистратору для увеличения лимита.`,
      status: 409,
    };
  }
  return { error: 'validation' as const, message: error.message, status: 400 };
}

export async function createBranch(params: {
  admin: BranchCreateAdminLike;
  bizId: string;
  body: BranchCreateBody;
}): Promise<BranchCreateResult> {
  const { admin, bizId, body } = params;

  if (!body.name?.trim()) {
    return {
      ok: false,
      error: 'validation',
      message: 'Название филиала обязательно',
      status: 400,
    };
  }

  let coordsWkt: string | null = null;
  if (body.lat != null && body.lon != null) {
    const v = validateLatLon(body.lat, body.lon);
    if (!v.ok) {
      return {
        ok: false,
        error: 'validation',
        message: 'Некорректные координаты',
        status: 400,
      };
    }

    coordsWkt = coordsToEWKT(v.lat, v.lon);
  }

  const { data, error } = await admin
    .from('branches')
    .insert({
      biz_id: bizId,
      name: body.name.trim(),
      address: body.address ?? null,
      is_active: body.is_active ?? true,
      coords: coordsWkt,
    })
    .select('id')
    .single();

  if (error) {
    return { ok: false, ...branchCreateError(error) };
  }

  return {
    ok: true,
    data: { id: data?.id },
  };
}
