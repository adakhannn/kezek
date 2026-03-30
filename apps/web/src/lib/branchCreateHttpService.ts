import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import {
  createBranch,
  type BranchCreateAdminLike,
  type BranchCreateBody,
} from '@/lib/branchCreateService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runBranchCreateHttp(req: Request): Promise<NextResponse> {
  const { supabase, bizId } = await getBizContextForManagers();

  const { data: isSuper } = await supabase.rpc('is_super_admin');
  if (!isSuper) {
    return createErrorResponse(
      'forbidden',
      'Только суперадмин может создавать филиалы',
      undefined,
      403,
    );
  }

  const body = (await req.json().catch(() => ({} as BranchCreateBody))) as BranchCreateBody;
  const result = await createBranch({
    admin: getServiceClient() as unknown as BranchCreateAdminLike,
    bizId,
    body,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}
