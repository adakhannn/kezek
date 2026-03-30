import { loadPromotionsDebugData } from '@/lib/promotionsDebugService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PromotionsDebugAuthClientLike = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
    }>;
  };
  from: (table: string) => {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        eq: (...args: unknown[]) => {
          single: () => Promise<{
            data: unknown;
            error: unknown;
          }>;
        };
      };
    };
  };
};

export type PromotionsDebugRouteResult =
  | { ok: true; data: Awaited<ReturnType<typeof loadPromotionsDebugData>> }
  | {
      ok: false;
      error: 'auth' | 'forbidden' | 'validation';
      message: string;
      status: number;
    };

function validateUuidParam(value: string | null, name: 'clientId' | 'branchId' | 'bizId') {
  if (!value) {
    return null;
  }

  if (!UUID_RE.test(value)) {
    return {
      ok: false as const,
      error: 'validation' as const,
      message: `Неверный формат ${name} (требуется UUID)`,
      status: 400,
    };
  }

  return null;
}

export async function runPromotionsDebugRoute(params: {
  authClient: PromotionsDebugAuthClientLike;
  serviceClient: Parameters<typeof loadPromotionsDebugData>[0]['serviceClient'];
  requestUrl: string;
}): Promise<PromotionsDebugRouteResult> {
  const {
    data: { user },
  } = await params.authClient.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'auth',
      message: 'Не авторизован',
      status: 401,
    };
  }

  const { data: roleData } = await params.authClient
    .from('user_roles')
    .select('roles!inner(key)')
    .eq('user_id', user.id)
    .eq('roles.key', 'super_admin')
    .single();

  if (!roleData) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Доступ запрещен: только для суперадмина',
      status: 403,
    };
  }

  const { searchParams } = new URL(params.requestUrl);
  const clientId = searchParams.get('clientId');
  const branchId = searchParams.get('branchId');
  const bizId = searchParams.get('bizId');

  if (!clientId && !branchId && !bizId) {
    return {
      ok: false,
      error: 'validation',
      message: 'Требуется clientId, branchId или bizId',
      status: 400,
    };
  }

  const clientValidation = validateUuidParam(clientId, 'clientId');
  if (clientValidation) return clientValidation;
  const branchValidation = validateUuidParam(branchId, 'branchId');
  if (branchValidation) return branchValidation;
  const bizValidation = validateUuidParam(bizId, 'bizId');
  if (bizValidation) return bizValidation;

  return {
    ok: true,
    data: await loadPromotionsDebugData({
      serviceClient: params.serviceClient,
      clientId,
      branchId,
      bizId,
    }),
  };
}
