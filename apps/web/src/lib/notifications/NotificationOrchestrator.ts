// apps/web/src/lib/notifications/NotificationOrchestrator.ts

import { type SupabaseClient } from '@supabase/supabase-js';

import { EmailNotificationService } from './EmailNotificationService';
import { ParticipantDataService } from './ParticipantDataService';
import { TelegramNotificationService } from './TelegramNotificationService';
import { WhatsAppNotificationService } from './WhatsAppNotificationService';
import type { 
    BookingRow, 
    EmailRecipient, 
    NotificationResult, 
    NotifyType,
    ParticipantData,
    BookingDetails 
} from './types';
import { first, normalizeEmails } from './utils';

import { getSiteOrigin } from '@/lib/env';
import { getTimezone } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';

export class NotificationOrchestrator {
    private participantService: ParticipantDataService;
    private emailService: EmailNotificationService;
    private whatsappService: WhatsAppNotificationService;
    private telegramService: TelegramNotificationService;
    private timezone: string;
    private origin: string;

    constructor(
        supabase: SupabaseClient,
        admin: SupabaseClient,
        emailConfig: { apiKey: string; from: string; replyTo?: string }
    ) {
        this.participantService = new ParticipantDataService(supabase, admin);
        this.emailService = new EmailNotificationService(emailConfig);
        this.whatsappService = new WhatsAppNotificationService();
        this.telegramService = new TelegramNotificationService();
        this.timezone = getTimezone();
        
        // Всегда используем kezek.kg для ссылок в письмах
        const originEnv = getSiteOrigin();
        this.origin = originEnv.includes('vercel.app') ? 'https://kezek.kg' : originEnv;
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

        // Извлекаем данные из бронирования
        const service = first(booking.services);
        const staff = first(booking.staff);
        const biz = first(booking.biz);
        const branch = first(booking.branches);

        // Получаем данные участников
        const [clientData, ownerData, staffData] = await Promise.all([
            this.participantService.getClientData(booking),
            this.participantService.getOwnerData(biz),
            this.participantService.getStaffData(staff),
        ]);

        // Формируем детали бронирования
        const bookingDetails: BookingDetails = {
            booking,
            service,
            staff,
            biz,
            branch,
            clientName: clientData.name,
            clientPhone: clientData.phone,
            clientEmail: clientData.email,
            origin: this.origin,
            timezone: this.timezone,
        };

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
    private buildEmailRecipients(
        clientData: ParticipantData,
        staffData: ParticipantData,
        ownerData: ParticipantData,
        biz: { email_notify_to: string[] | null } | null
    ): EmailRecipient[] {
        const recipients: EmailRecipient[] = [];

        // Клиент — отдельное письмо с .ics (только если включены email уведомления)
        if (clientData.notifyEmail) {
            const clientEmails = clientData.notificationEmails.length > 0
                ? clientData.notificationEmails
                : clientData.email ? [clientData.email] : [];
            for (const email of clientEmails) {
                recipients.push({
                    email,
                    name: clientData.name,
                    role: 'client',
                    withIcs: true,
                });
            }
        }

        // Мастер
        const staffEmails = staffData.notificationEmails.length > 0
            ? staffData.notificationEmails
            : staffData.email ? [staffData.email] : [];
        if (staffData.notifyEmail) {
            for (const email of staffEmails) {
                recipients.push({
                    email,
                    name: staffData.name,
                    role: 'staff',
                });
            }
        }

        // Владелец
        const ownerEmails = ownerData.notificationEmails.length > 0
            ? ownerData.notificationEmails
            : ownerData.email ? [ownerData.email] : [];
        if (ownerData.notifyEmail) {
            for (const email of ownerEmails) {
                recipients.push({
                    email,
                    name: ownerData.name,
                    role: 'owner',
                });
            }
        }

        // Администраторы из списка
        const adminEmails = biz?.email_notify_to ?? [];
        const normalizedAdminEmails = normalizeEmails(adminEmails);
        const ownerEmailSet = new Set(ownerEmails.map((email) => email.toLowerCase().trim()));
        
        for (const em of normalizedAdminEmails) {
            const emNormalized = em.toLowerCase().trim();
            // Пропускаем email, который уже используется как ownerEmail
            if (ownerEmailSet.has(emNormalized)) {
                continue;
            }
            recipients.push({ email: em, name: null, role: 'admin' });
        }

        // Дедуп по email (оставляем первый встретившийся вариант)
        const uniqMap = new Map<string, EmailRecipient>();
        for (const r of recipients) {
            if (!uniqMap.has(r.email)) {
                uniqMap.set(r.email, r);
            }
        }

        return Array.from(uniqMap.values());
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

        const results = await Promise.allSettled([
            this.telegramService.sendToClient(clientData, bookingDetails, notifyType),
            this.telegramService.sendToStaff(staffData, bookingDetails, notifyType),
            this.telegramService.sendToOwner(ownerData, bookingDetails, notifyType),
        ]);

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

