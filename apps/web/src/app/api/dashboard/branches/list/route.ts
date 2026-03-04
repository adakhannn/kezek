import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { withManagerContext } from '@/lib/withManagerContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  return withErrorHandler('DashboardBranchesList', async () => {
    return withManagerContext(req, 'DashboardBranchesList', async ({ supabase, bizId }) => {
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
  });
}

