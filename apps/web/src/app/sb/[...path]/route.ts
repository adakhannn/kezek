import { handleSupabaseProxyRequest } from '@/lib/supabaseProxy';

/**
 * Optional same-origin proxy of the Supabase project (R25-31, B1). Answers 404 to every request unless the
 * server has SUPABASE_PROXY_ENABLED=true; see docs/SUPABASE_ACCESS_OPTIONS.md.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const proxy = (req: Request) => handleSupabaseProxyRequest(req);

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
