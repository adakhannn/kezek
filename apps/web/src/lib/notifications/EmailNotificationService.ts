// apps/web/src/lib/notifications/EmailNotificationService.ts

import { buildEmailHtml, buildEmailText } from './messageBuilders';
import type { EmailRecipient, BookingDetails, NotifyType } from './types';
import { buildHtmlPersonal } from './utils';

import { buildIcs } from '@/lib/ics';
import { logDebug, logError, logWarn } from '@/lib/log';

export interface EmailConfig {
    apiKey: string;
    from: string;
    replyTo?: string;
}

export class EmailNotificationService {
    private readonly RESEND_RATE_LIMIT_DELAY_MS = 600; // 600ms между запросами

    constructor(private config: EmailConfig) {}

    /**
     * Отправляет email уведомления получателям
     */
    async sendNotifications(
        recipients: EmailRecipient[],
        bookingDetails: BookingDetails,
        notifyType: NotifyType
    ): Promise<number> {
        if (recipients.length === 0) {
            logDebug('EmailNotificationService', 'No recipients to notify');
            return 0;
        }

        const baseHtml = buildEmailHtml(bookingDetails, notifyType);
        const text = buildEmailText(bookingDetails, notifyType);
        
        // Готовим .ics для клиента (один раз)
        const icsText = buildIcs({
            id: bookingDetails.booking.id,
            summary: `${bookingDetails.service?.name_ru ?? 'Услуга'} — ${bookingDetails.biz?.name ?? 'Бизнес'}`,
            description: `${notifyType === 'hold' ? 'Удержание слота' : notifyType === 'confirm' ? 'Бронь подтверждена' : 'Бронь отменена'}. Мастер: ${bookingDetails.staff?.full_name ?? 'Мастер'}`,
            location: bookingDetails.biz?.address ?? '',
            startISO: bookingDetails.booking.start_at,
            endISO: bookingDetails.booking.end_at,
            tz: bookingDetails.timezone,
            url: `${bookingDetails.origin}/booking/${bookingDetails.booking.id}`,
        });
        const icsBase64 = Buffer.from(icsText, 'utf8').toString('base64');

        const headers = {
            'content-type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
        } as const;

        logDebug('EmailNotificationService', 'Starting email sending', { 
            recipientsCount: recipients.length 
        });

        let sent = 0;

        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            
            // Добавляем задержку перед каждым запросом, кроме первого
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, this.RESEND_RATE_LIMIT_DELAY_MS));
            }

            try {
                const htmlPersonal = buildHtmlPersonal(baseHtml, recipient.name, recipient.role);
                const payload: Record<string, unknown> = {
                    from: this.config.from,
                    to: [recipient.email],
                    subject: `Kezek: ${notifyType === 'hold' ? 'Удержание слота' : notifyType === 'confirm' ? 'Бронь подтверждена' : 'Бронь отменена'}`,
                    html: htmlPersonal,
                    text,
                };

                if (this.config.replyTo) {
                    payload.reply_to = this.config.replyTo;
                }

                if (recipient.withIcs) {
                    payload.attachments = [{ 
                        filename: 'booking.ics', 
                        content: icsBase64
                    }];
                }

                const emailResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                });

                if (!emailResponse.ok) {
                    const errorText = await emailResponse.text().catch(() => 'Unknown error');
                    
                    // Если это rate limit ошибка, ждем и пробуем еще раз
                    if (emailResponse.status === 429) {
                        const retryAfter = emailResponse.headers.get('retry-after');
                        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
                        logWarn('EmailNotificationService', 'Rate limit hit, retrying', { 
                            recipient: recipient.email,
                            waitTime 
                        });
                        
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        
                        const retryResponse = await fetch('https://api.resend.com/emails', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(payload),
                        });

                        if (retryResponse.ok) {
                            sent += 1;
                            logDebug('EmailNotificationService', 'Email sent after retry', { 
                                recipient: recipient.email 
                            });
                        } else {
                            logError('EmailNotificationService', 'Retry failed', {
                                recipient: recipient.email,
                                status: retryResponse.status,
                            });
                        }
                    } else {
                        logError('EmailNotificationService', 'Failed to send email', {
                            recipient: recipient.email,
                            role: recipient.role,
                            status: emailResponse.status,
                            error: errorText,
                        });
                    }
                } else {
                    const result = await emailResponse.json().catch(() => ({}));
                    const emailId = (result as { id?: string })?.id || 'unknown';
                    sent += 1;
                    logDebug('EmailNotificationService', 'Email sent successfully', {
                        recipient: recipient.email,
                        emailId,
                    });
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                logError('EmailNotificationService', 'Exception while sending email', {
                    recipient: recipient.email,
                    role: recipient.role,
                    error: errorMsg,
                });
            }
        }

        logDebug('EmailNotificationService', 'Email sending completed', { sent, total: recipients.length });
        return sent;
    }
}

