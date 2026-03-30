export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runHealthCheckAlertsCronHttp } from '@/lib/healthCheckAlertsCronHttpService';

/**
 * GET /api/cron/health-check-alerts
 * Cron job для периодической проверки здоровья системы и отправки алертов.
 */
export async function GET(req: Request) {
  return withErrorHandler('HealthCheckAlerts', () => runHealthCheckAlertsCronHttp(req));
}
