export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runAuthSignOutHttp } from '@/lib/authSignOutHttpService';

/**
 * POST /api/auth/sign-out
 * РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅС‹Р№ РІС‹С…РѕРґ С‡РµСЂРµР· Admin API
 */
export async function POST(_req: Request) {
  return withErrorHandler('AuthSignOut', async () => runAuthSignOutHttp());
}
