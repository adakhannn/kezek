import { type PublicContactFields, validatePublicContacts } from '@/lib/businessContacts';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { coordsToEWKT, validateLatLon } from '@/lib/validation';

export type BranchUpdateBody = PublicContactFields & {
  name: string;
  address?: string | null;
  is_active: boolean;
  lat?: number | null;
  lon?: number | null;
  inherit_business_contacts?: boolean;
};

export type BranchUpdateAdminLike = {
  from: (table: string) => {
    update: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        eq: (...args: unknown[]) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

export type BranchUpdateResult =
  | { ok: true; data: Record<string, never> }
  | {
      ok: false;
      error: 'validation' | 'not_found' | 'forbidden';
      message: string;
      status: number;
      details?: Record<string, unknown>;
    };

export async function updateBranch(params: {
  admin: BranchUpdateAdminLike;
  branchId: string;
  bizId: string;
  body: BranchUpdateBody;
}): Promise<BranchUpdateResult> {
  const { admin, branchId, bizId, body } = params;

  if (!body.name?.trim()) {
    return {
      ok: false,
      error: 'validation',
      message: 'Имя обязательно',
      status: 400,
    };
  }

  const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
    admin as never,
    'branches',
    branchId,
    bizId,
    'id, biz_id',
  );

  if (branchCheck.error || !branchCheck.data) {
    if (branchCheck.error === 'Resource not found') {
      return {
        ok: false,
        error: 'not_found',
        message: 'Филиал не найден',
        status: 404,
      };
    }

    return {
      ok: false,
      error: 'forbidden',
      message: 'Филиал не принадлежит этому бизнесу',
      details: { currentBizId: bizId },
      status: 403,
    };
  }

  const contacts = validatePublicContacts(body);
  if (!contacts.ok) {
    return {
      ok: false,
      error: 'validation',
      message: contacts.message,
      status: 400,
    };
  }

  const updateData: {
    name: string;
    address: string | null;
    is_active: boolean;
    coords?: string | null;
    contact_phone: string | null;
    contact_whatsapp: string | null;
    contact_email: string | null;
    website_url: string | null;
    inherit_business_contacts: boolean;
  } = {
    name: body.name.trim(),
    address: body.address ?? null,
    is_active: !!body.is_active,
    ...contacts.value,
    inherit_business_contacts: body.inherit_business_contacts !== false,
  };

  if ('lat' in body || 'lon' in body) {
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

      updateData.coords = coordsToEWKT(v.lat, v.lon);
    } else {
      updateData.coords = null;
    }
  }

  const { error } = await admin
    .from('branches')
    .update(updateData)
    .eq('id', branchId)
    .eq('biz_id', bizId);

  if (error) {
    return {
      ok: false,
      error: 'validation',
      message: error.message,
      status: 400,
    };
  }

  return {
    ok: true,
    data: {},
  };
}
