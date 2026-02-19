export const runtime = 'nodejs';
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('NotifyPing', async () => {
            const { to, from: fromBody } = await req.json();
            const apiKey = process.env.RESEND_API_KEY;
            // приоритет: что пришло в теле → иначе из ENV → дефолт
            const from = fromBody || process.env.EMAIL_FROM || 'Kezek <onboarding@resend.dev>';

            if (!apiKey) {
                return createErrorResponse('validation', 'RESEND_API_KEY не установлен', { code: 'no RESEND_API_KEY' }, 400);
            }

            const resp = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ from, to, subject: 'Kezek test', html: '<b>Ping from Kezek</b>' }),
            });

            const text = await resp.text().catch(() => '');
            return createSuccessResponse({ ok: resp.ok, status: resp.status, text });
        })
    );
}