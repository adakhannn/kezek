import { Resend } from 'resend';

import { logDebug, logError } from './log';

let resendClient: Resend | null = null;

function getResend(): Resend {
    if (!resendClient) {
        const key = process.env.RESEND_API_KEY;
        if (!key) throw new Error('RESEND_API_KEY is not configured');
        resendClient = new Resend(key);
    }
    return resendClient;
}

const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || process.env.EMAIL_FROM || 'admin@kezek.kg';
const ALERT_EMAIL_FROM = process.env.EMAIL_FROM || 'Kezek <noreply@mail.kezek.kg>';

type AlertType = 'error' | 'warning';

type Alert = {
    type: AlertType;
    message: string;
    details?: Record<string, unknown>;
};

/**
 * Отправляет алерт по email через Resend
 */
export async function sendAlertEmail(alerts: Alert[]): Promise<{ success: boolean; error?: string }> {
    if (!process.env.RESEND_API_KEY) {
        logError('Alerts', 'RESEND_API_KEY not configured, skipping email alert');
        return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    if (alerts.length === 0) {
        return { success: true };
    }

    const errorCount = alerts.filter((a) => a.type === 'error').length;
    const warningCount = alerts.filter((a) => a.type === 'warning').length;

    const subject = `🚨 Kezek Alert: ${errorCount} ошибок, ${warningCount} предупреждений`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .alert { padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid; }
        .alert-error { background-color: #fee; border-color: #c33; }
        .alert-warning { background-color: #fff4e6; border-color: #f90; }
        .alert-title { font-weight: bold; margin-bottom: 5px; }
        .alert-details { margin-top: 10px; font-size: 0.9em; color: #666; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚨 Kezek System Alert</h1>
        <p>Обнаружены проблемы в системе Kezek:</p>
        
        ${alerts
            .map(
                (alert) => `
            <div class="alert alert-${alert.type}">
                <div class="alert-title">${alert.type === 'error' ? '❌ Ошибка' : '⚠️ Предупреждение'}</div>
                <div>${alert.message}</div>
                ${alert.details
                    ? `<div class="alert-details"><pre>${JSON.stringify(alert.details, null, 2)}</pre></div>`
                    : ''}
            </div>
        `
            )
            .join('')}
        
        <div class="footer">
            <p>Это автоматическое уведомление от системы мониторинга Kezek.</p>
            <p>Проверьте панель администрирования: <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://kezek.kg'}/admin/health-check">Health Check</a></p>
        </div>
    </div>
</body>
</html>
    `;

    try {
        const { data, error } = await getResend().emails.send({
            from: ALERT_EMAIL_FROM,
            to: ALERT_EMAIL_TO,
            subject,
            html,
        });

        if (error) {
            logError('Alerts', 'Failed to send email alert', error);
            return { success: false, error: error.message };
        }

        logDebug('Alerts', 'Email alert sent successfully', { id: data?.id });
        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logError('Alerts', 'Exception sending email alert', { message, error });
        return { success: false, error: message };
    }
}

