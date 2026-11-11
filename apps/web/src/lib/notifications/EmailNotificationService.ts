// apps/web/src/lib/notifications/EmailNotificationService.ts

import { buildBookingEmailPayload } from './emailPayload';
import type { EmailRecipient, BookingDetails, NotifyType } from './types';



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
                const payload = buildBookingEmailPayload(recipient, bookingDetails, notifyType, this.config);

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

