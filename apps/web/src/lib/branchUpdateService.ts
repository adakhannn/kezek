import type { z } from 'zod';

import { validatePublicContactPatch } from '@/lib/businessContacts';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { validateDirectoryLinks } from '@/lib/directoryLinks';
import type { DbClient, DbUpdate } from '@/lib/supabaseTypes';
import { coordsToEWKT, validateLatLon } from '@/lib/validation';
import { branchUpdateSchema } from '@/lib/validation/businessUpdateSchemas';

export type BranchUpdateBody = z.infer<typeof branchUpdateSchema>;

export type BranchUpdateAdminLike = DbClient;

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
  const { admin, branchId, bizId } = params;
  const parsed = branchUpdateSchema.safeParse(params.body);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation',
      message: parsed.error.issues[0].message,
      status: 400,
    };
  }
  const body = parsed.data;

  const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
    admin,
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

  const contacts = validatePublicContactPatch(body);
  if (!contacts.ok) {
    return {
      ok: false,
      error: 'validation',
      message: contacts.message,
      status: 400,
    };
  }

  const updateData: DbUpdate<'branches'> = { ...contacts.value };
  if (Object.hasOwn(body, 'name')) updateData.name = body.name;
  if (Object.hasOwn(body, 'address')) updateData.address = body.address;
  if (Object.hasOwn(body, 'is_active')) updateData.is_active = body.is_active;
  if (Object.hasOwn(body, 'inherit_business_contacts')) updateData.inherit_business_contacts = body.inherit_business_contacts;
  if (Object.hasOwn(body, 'directory_links')) {
    const links = validateDirectoryLinks(body.directory_links);
    if (!links.ok) {
      return {
        ok: false,
        error: 'validation',
        message: links.message,
        status: 400,
      };
    }
    updateData.directory_links = links.value;
  }

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
