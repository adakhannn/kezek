// apps/web/src/lib/notifications/NotificationOrchestrator.ts

import { type SupabaseClient } from '@supabase/supabase-js';

import { prepareBookingNotificationContext } from './BookingNotificationPlanner';
import { EmailNotificationService } from './EmailNotificationService';
import { ParticipantDataService } from './ParticipantDataService';
import { TelegramNotificationService } from './TelegramNotificationService';
import { WhatsAppNotificationService } from './WhatsAppNotificationService';
import { buildEmailRecipients } from './emailRecipients';
import { uniqueTelegramRecipients } from './telegramRecipients';
import type { 
    BookingRow, 
    EmailRecipient, 
    NotificationResult, 
    NotifyType,
    ParticipantData,
    BookingDetails 
} from './types';

import { logDebug, logError } from '@/lib/log';

export class NotificationOrchestrator {
    private participantService: ParticipantDataService;
    private emailService: EmailNotificationService;
    private whatsappService: WhatsAppNotificationService;
    private telegramService: TelegramNotificationService;

    constructor(
        supabase: SupabaseClient,
        admin: SupabaseClient,
        emailConfig: { apiKey: string; from: string; replyTo?: string }
    ) {
        this.participantService = new ParticipantDataService(supabase, admin);
        this.emailService = new EmailNotificationService(emailConfig);
        this.whatsappService = new WhatsAppNotificationService();
        this.telegramService = new TelegramNotificationService();

    }

    /**
     * Отправляет уведомления для бронирования
     */
    async sendNotifications(
        booking: BookingRow,
        notifyType: NotifyType
    ): Promise<NotificationResult> {
        logDebug('NotificationOrchestrator', 'Starting notifications', {
            booking_id: booking.id,
            type: notifyType,
        });

        const { details: bookingDetails, clientData, staffData, ownerData } = await prepareBookingNotificationContext(this.participantService, booking);
        const biz = bookingDetails.biz;

        // Формируем список получателей email
        const emailRecipients = this.buildEmailRecipients(
            clientData,
            staffData,
            ownerData,
            biz
        );

        // Отправляем уведомления параллельно
        const [emailsSent, whatsappSent, telegramSent] = await Promise.all([
            this.emailService.sendNotifications(emailRecipients, bookingDetails, notifyType),
            this.sendWhatsAppNotifications(clientData, staffData, ownerData, bookingDetails, notifyType),
            this.sendTelegramNotifications(clientData, staffData, ownerData, bookingDetails, notifyType),
        ]);

        const result: NotificationResult = {
            emailsSent,
            whatsappSent,
            telegramSent,
        };

        logDebug('NotificationOrchestrator', 'Notifications completed', result);
        return result;
    }

    /**
     * Формирует список получателей email
     */
    private buildEmailRecipients(clientData: ParticipantData, staffData: ParticipantData, ownerData: ParticipantData, biz: { email_notify_to: string[] | null } | null): EmailRecipient[] {
        return buildEmailRecipients(clientData, staffData, ownerData, biz);
    }

    /**
     * Отправляет WhatsApp уведомления
     */
    private async sendWhatsAppNotifications(
        clientData: ParticipantData,
        staffData: ParticipantData,
        ownerData: ParticipantData,
        bookingDetails: BookingDetails,
        notifyType: NotifyType
    ): Promise<number> {
        let sent = 0;

        const results = await Promise.allSettled([
            this.whatsappService.sendToClient(clientData, bookingDetails, notifyType),
            this.whatsappService.sendToStaff(staffData, bookingDetails, notifyType),
            this.whatsappService.sendToOwner(ownerData, bookingDetails, notifyType),
        ]);

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                sent += 1;
            } else if (result.status === 'rejected') {
                logError('NotificationOrchestrator', 'WhatsApp notification failed', result.reason);
            }
        }

        return sent;
    }

    /**
     * Отправляет Telegram уведомления
     */
    private async sendTelegramNotifications(
        clientData: ParticipantData,
        staffData: ParticipantData,
        ownerData: ParticipantData,
        bookingDetails: BookingDetails,
        notifyType: NotifyType
    ): Promise<number> {
        let sent = 0;

        const senders = {
            client: (data: ParticipantData) => this.telegramService.sendToClient(data, bookingDetails, notifyType),
            staff: (data: ParticipantData) => this.telegramService.sendToStaff(data, bookingDetails, notifyType),
            owner: (data: ParticipantData) => this.telegramService.sendToOwner(data, bookingDetails, notifyType),
        };
        const results = await Promise.allSettled(
            uniqueTelegramRecipients(clientData, staffData, ownerData)
                .map(({ role, data }) => senders[role](data)),
        );

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                sent += 1;
            } else if (result.status === 'rejected') {
                logError('NotificationOrchestrator', 'Telegram notification failed', result.reason);
            }
        }

        return sent;
    }
}

