/**
 * Уведомления о закрытии смены
 *
 * E-mail only. Each recipient (the employee and the business owner) gets the letter in their own
 * profiles.preferred_locale (FE-10); NULL, an unknown value or a missing profile means Russian.
 */

import { DEFAULT_BUSINESS_TIME_ZONE } from '@shared-client/timezone';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
    formatNotificationDate,
    formatNotificationMoney,
    notificationLocale,
    notificationText,
    type NotificationLocale,
    type NotificationTextKey,
} from './notificationText';

import { getResendApiKey, getEmailFrom } from '@/lib/env';
import { escapeHtml } from '@/lib/htmlEscape';
import { logDebug, logError } from '@/lib/log';

export type ShiftCloseNotificationData = {
    /** The employee's name; null or empty shows the word "employee" in the recipient's language. */
    staffName: string | null;
    staffEmail: string;
    /** profiles.preferred_locale of the employee. */
    staffLocale?: string | null;
    ownerEmail?: string | null;
    /** profiles.preferred_locale of the business owner. */
    ownerLocale?: string | null;
    /** YYYY-MM-DD: the day of the business calendar, shown as is in every zone (ARCH-11). */
    shiftDate: string;
    totalAmount: number;
    masterShare: number;
    salonShare: number;
    itemsCount: number;
    hoursWorked: number | null;
    guaranteedAmount: number | null;
    topupAmount: number | null;
};

type ShiftCloseEmail = { subject: string; html: string; text: string };

/** The shift-close letter in `locale`; the Russian letter is the text it had before FE-10. */
export function buildShiftCloseEmail(data: ShiftCloseNotificationData, locale: NotificationLocale): ShiftCloseEmail {
    const t = (key: string, values?: Record<string, string | number>) =>
        notificationText(locale, `server.notifications.${key}` as NotificationTextKey, values);
    const money = (amount: number) => formatNotificationMoney(amount, locale);
    const date = formatNotificationDate(data.shiftDate, DEFAULT_BUSINESS_TIME_ZONE, locale);
    const staffName = data.staffName?.trim() || t('shiftStaffFallback');
    const title = t('shiftTitle');
    const details = t('shiftDetails');
    const label = {
        date: t('shiftDate'),
        clients: t('shiftClients'),
        turnover: t('shiftTurnover'),
        toStaff: t('shiftToStaff'),
        toBusiness: t('shiftToBusiness'),
        hours: t('shiftHours'),
        guaranteed: t('shiftGuaranteed'),
        topup: t('shiftTopup'),
    };

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
                        <h1>${title}</h1>
                        <p>${t('shiftClosedBy', { staff: escapeHtml(staffName), date })}</p>
                    </div>
                    <div class="content">
                        <div class="summary">
                            <div class="summary-row">
                                <span class="label">${label.date}:</span>
                                <span class="value">${date}</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">${label.clients}:</span>
                                <span class="value">${data.itemsCount}</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">${label.turnover}:</span>
                                <span class="value highlight">${money(data.totalAmount)}</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">${label.toStaff}:</span>
                                <span class="value highlight">${money(data.masterShare)}</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">${label.toBusiness}:</span>
                                <span class="value highlight">${money(data.salonShare)}</span>
                            </div>
                            ${data.hoursWorked ? `
                            <div class="summary-row">
                                <span class="label">${label.hours}:</span>
                                <span class="value">${data.hoursWorked.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            ${data.guaranteedAmount ? `
                            <div class="summary-row">
                                <span class="label">${label.guaranteed}:</span>
                                <span class="value">${money(data.guaranteedAmount)}</span>
                            </div>
                            ` : ''}
                            ${data.topupAmount && data.topupAmount > 0 ? `
                            <div class="summary-row">
                                <span class="label">${label.topup}:</span>
                                <span class="value">${money(data.topupAmount)}</span>
                            </div>
                            ` : ''}
                        </div>
                        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                            ${details}
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;

    const text = `
${title}

${t('shiftClosedBy', { staff: staffName, date })}

${t('shiftSummary')}:
- ${label.clients}: ${data.itemsCount}
- ${label.turnover}: ${money(data.totalAmount)}
- ${label.toStaff}: ${money(data.masterShare)}
- ${label.toBusiness}: ${money(data.salonShare)}
${data.hoursWorked ? `- ${label.hours}: ${data.hoursWorked.toFixed(2)}\n` : ''}
${data.guaranteedAmount ? `- ${label.guaranteed}: ${money(data.guaranteedAmount)}\n` : ''}
${data.topupAmount && data.topupAmount > 0 ? `- ${label.topup}: ${money(data.topupAmount)}\n` : ''}

${details}
        `;

    return { subject: t('shiftSubject', { date }), html, text };
}

/**
 * profiles.preferred_locale of each of `userIds`. A failed read is logged and leaves the users out,
 * so they get Russian: the shift is already closed and the letter must not be lost over a language.
 */
export async function readNotificationLocales(
    admin: Pick<SupabaseClient, 'from'>,
    userIds: Array<string | null | undefined>,
): Promise<Map<string, NotificationLocale>> {
    const locales = new Map<string, NotificationLocale>();
    const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
    if (!ids.length) return locales;
    try {
        const { data, error } = await admin.from('profiles').select('id,preferred_locale').in('id', ids);
        if (error) throw error;
        for (const row of (data ?? []) as Array<{ id: string; preferred_locale: string | null }>) {
            locales.set(row.id, notificationLocale(row.preferred_locale));
        }
    } catch (error) {
        logError('ShiftNotifications', 'Could not read the recipients\' notification language', error);
    }
    return locales;
}

/**
 * Отправляет email уведомление о закрытии смены
 */
export async function sendShiftCloseNotification(data: ShiftCloseNotificationData): Promise<void> {
    try {
        const apiKey = getResendApiKey();
        const from = getEmailFrom();
        if (!from) {
            logError('ShiftNotifications', 'EMAIL_FROM not configured, skipping shift close email');
            return;
        }

        // role identifies the recipient in logs, which never carry the address itself.
        const recipients: Array<{ email: string; locale: NotificationLocale; role: 'staff' | 'owner' }> = [
            { email: data.staffEmail, locale: notificationLocale(data.staffLocale), role: 'staff' },
        ];

        // Добавляем владельца, если email указан
        if (data.ownerEmail) {
            recipients.push({ email: data.ownerEmail, locale: notificationLocale(data.ownerLocale), role: 'owner' });
        }

        // Отправляем письма, каждое на языке получателя
        let sentCount = 0;
        for (const recipient of recipients) {
            try {
                const { subject, html, text } = buildShiftCloseEmail(data, recipient.locale);
                const response = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        from,
                        to: [recipient.email],
                        subject,
                        html,
                        text,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    logError('ShiftNotifications', 'Failed to send shift close email', {
                        recipient: recipient.role,
                        status: response.status,
                        error: errorData,
                    });
                } else {
                    sentCount++;
                    logDebug('ShiftNotifications', 'Shift close email sent', { recipient: recipient.role, locale: recipient.locale });
                }
            } catch (error) {
                logError('ShiftNotifications', 'Error sending shift close email', { recipient: recipient.role, error });
            }
        }

        logDebug('ShiftNotifications', 'Shift close notifications sent', {
            sentCount,
            totalRecipients: recipients.length,
            staffName: data.staffName,
            shiftDate: data.shiftDate,
        });
    } catch (error) {
        // Не блокируем закрытие смены, если уведомление не отправилось
        logError('ShiftNotifications', 'Failed to send shift close notification', error);
    }
}
