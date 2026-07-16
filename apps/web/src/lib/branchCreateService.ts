import { coordsToEWKT, validateLatLon } from '@/lib/validation';

export type BranchCreateBody = {
  name: string;
  address?: string | null;
  is_active?: boolean;
  lat?: number | null;
  lon?: number | null;
  directory_links?: Record<string, string | null>;
};

export type BranchCreateAdminLike = {
  // Supabase's generated PostgREST types are intentionally not coupled to this
  // small service: the service is shared by admin and owner API clients.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
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

  const explicitLinks = normalizeDirectoryLinks(body.directory_links);
  const directoryLinks = await resolveInitialDirectoryLinks(admin, bizId, explicitLinks);

  const { data, error } = await admin
    .from('branches')
    .insert({
      biz_id: bizId,
      name: body.name.trim(),
      address: body.address ?? null,
      is_active: body.is_active ?? true,
      coords: coordsWkt,
      directory_links: directoryLinks,
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

function normalizeDirectoryLinks(input?: Record<string, string | null>) {
  const keys = ['instagram', 'two_gis', 'google_maps', 'yandex_maps'] as const;
  return Object.fromEntries(keys.map((key) => [key, typeof input?.[key] === 'string' && input[key]?.trim() ? input[key]!.trim() : null]));
}

function hasDirectoryLinks(input: Record<string, string | null>) {
  return Object.values(input).some(Boolean);
}

export async function resolveInitialDirectoryLinks(
  admin: BranchCreateAdminLike,
  bizId: string,
  explicitLinks: Record<string, string | null>,
) {
  if (hasDirectoryLinks(explicitLinks)) return explicitLinks;

  const { data: existingBranch, error: branchError } = await admin
    .from('branches')
    .select('id')
    .eq('biz_id', bizId)
    .limit(1)
    .maybeSingle();
  if (branchError || existingBranch) return explicitLinks;

  const { data: application, error: applicationError } = await admin
    .from('business_registration_applications')
    .select('directory_links,created_at')
    .eq('created_business_id', bizId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (applicationError || !application?.directory_links || typeof application.directory_links !== 'object') {
    return explicitLinks;
  }

  return normalizeDirectoryLinks(application.directory_links as Record<string, string | null>);
}
