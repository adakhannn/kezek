import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return withErrorHandler('DashboardBranchesList', async () => {
    const { supabase, bizId } = await getBizContextForManagers();

    const { data, error } = await supabase
      .from('branches')
      .select('id, name')
      .eq('biz_id', bizId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      return createErrorResponse('server', 'Failed to load branches', error.message, 500);
    }

    const branches = (data ?? []).map((b) => ({
      id: String(b.id),
      name: String(b.name ?? ''),
    }));

    return createSuccessResponse(branches);
  });
}

