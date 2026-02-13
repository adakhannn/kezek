/**
 * Уведомления о закрытии смены
 */

import { formatInTimeZone } from 'date-fns-tz';

import { getResendApiKey, getEmailFrom } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { TZ } from '@/lib/time';

type ShiftCloseNotificationData = {
    staffName: string;
    staffEmail: string;
    ownerEmail?: string | null;
    shiftDate: string;
    totalAmount: number;
    masterShare: number;
    salonShare: number;
    itemsCount: number;
    hoursWorked: number | null;
    guaranteedAmount: number | null;
    topupAmount: number | null;
};

/**
 * Отправляет email уведомление о закрытии смены
 */
export async function sendShiftCloseNotification(data: ShiftCloseNotificationData): Promise<void> {
    try {
        const apiKey = getResendApiKey();
        const from = getEmailFrom();

        const shiftDateFormatted = formatInTimeZone(new Date(data.shiftDate), TZ, 'dd.MM.yyyy');
        
        // Формируем HTML письмо
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
                    .summary { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
                    .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
                    .summary-row:last-child { border-bottom: none; }
                    .label { font-weight: 600; color: #6b7280; }
                    .value { font-weight: 700; color: #111827; }
                    .highlight { color: #059669; font-size: 1.2em; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Смена закрыта</h1>
                        <p>${data.staffName} закрыл(а) смену за ${shiftDateFormatted}</p>
                    </div>
                    <div class="content">
                        <div class="summary">
                            <div class="summary-row">
                                <span class="label">Дата смены:</span>
                                <span class="value">${shiftDateFormatted}</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">Количество клиентов:</span>
                                <span class="value">${data.itemsCount}</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">Общий оборот:</span>
                                <span class="value highlight">${data.totalAmount.toFixed(2)} сом</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">Сотруднику:</span>
                                <span class="value highlight">${data.masterShare.toFixed(2)} сом</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">Бизнесу:</span>
                                <span class="value highlight">${data.salonShare.toFixed(2)} сом</span>
                            </div>
                            ${data.hoursWorked ? `
                            <div class="summary-row">
                                <span class="label">Отработано часов:</span>
                                <span class="value">${data.hoursWorked.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            ${data.guaranteedAmount ? `
                            <div class="summary-row">
                                <span class="label">Гарантированная оплата:</span>
                                <span class="value">${data.guaranteedAmount.toFixed(2)} сом</span>
                            </div>
                            ` : ''}
                            ${data.topupAmount && data.topupAmount > 0 ? `
                            <div class="summary-row">
                                <span class="label">Доплата:</span>
                                <span class="value">${data.topupAmount.toFixed(2)} сом</span>
                            </div>
                            ` : ''}
                        </div>
                        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                            Подробности доступны в личном кабинете Kezek.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const text = `
Смена закрыта

${data.staffName} закрыл(а) смену за ${shiftDateFormatted}

Итоги:
- Количество клиентов: ${data.itemsCount}
- Общий оборот: ${data.totalAmount.toFixed(2)} сом
- Сотруднику: ${data.masterShare.toFixed(2)} сом
- Бизнесу: ${data.salonShare.toFixed(2)} сом
${data.hoursWorked ? `- Отработано часов: ${data.hoursWorked.toFixed(2)}\n` : ''}
${data.guaranteedAmount ? `- Гарантированная оплата: ${data.guaranteedAmount.toFixed(2)} сом\n` : ''}
${data.topupAmount && data.topupAmount > 0 ? `- Доплата: ${data.topupAmount.toFixed(2)} сом\n` : ''}

Подробности доступны в личном кабинете Kezek.
        `;

        // Отправляем уведомление сотруднику
        const recipients: Array<{ email: string; name: string }> = [
            { email: data.staffEmail, name: data.staffName },
        ];

        // Добавляем владельца, если email указан
        if (data.ownerEmail) {
            recipients.push({ email: data.ownerEmail, name: 'Владелец бизнеса' });
        }

        // Отправляем письма
        let sentCount = 0;
        for (const recipient of recipients) {
            try {
                const response = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        from,
                        to: [recipient.email],
                        subject: `Kezek: Смена закрыта за ${shiftDateFormatted}`,
                        html,
                        text,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    logError('ShiftNotifications', `Failed to send email to ${recipient.email}`, {
                        status: response.status,
                        error: errorData,
                    });
                } else {
                    sentCount++;
                    logDebug('ShiftNotifications', `Email sent to ${recipient.email}`);
                }
            } catch (error) {
                logError('ShiftNotifications', `Error sending email to ${recipient.email}`, error);
            }
        }

        logDebug('ShiftNotifications', 'Shift close notifications sent', {
            sentCount,
            totalRecipients: recipients.length,
            staffName: data.staffName,
            shiftDate: shiftDateFormatted,
        });
    } catch (error) {
        // Не блокируем закрытие смены, если уведомление не отправилось
        logError('ShiftNotifications', 'Failed to send shift close notification', error);
    }
}

