// apps/web/src/lib/notifications/WhatsAppNotificationService.ts

import { buildWhatsAppText } from './messageBuilders';
import type { ParticipantData, BookingDetails, NotifyType } from './types';

import { logDebug, logError, logWarn } from '@/lib/log';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

export class WhatsAppNotificationService {
    private readonly hasConfig: boolean;

    constructor() {
        this.hasConfig = !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
        if (!this.hasConfig) {
            logWarn('WhatsAppNotificationService', 'WhatsApp not configured: missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
        }
    }

    /**
     * Отправляет WhatsApp уведомление клиенту
     */
    async sendToClient(
        clientData: ParticipantData,
        bookingDetails: BookingDetails,
        notifyType: NotifyType
    ): Promise<boolean> {
        const whatsappPhone = clientData.whatsappPhone;
        if (!this.hasConfig || !whatsappPhone || !clientData.notifyWhatsApp || !clientData.whatsappVerified) {
            if (!whatsappPhone) {
                logDebug('WhatsAppNotificationService', 'No client WhatsApp phone');
            } else if (!clientData.notifyWhatsApp) {
                logDebug('WhatsAppNotificationService', 'Skipping WhatsApp to client: notifications disabled');
            } else if (!clientData.whatsappVerified) {
                logDebug('WhatsAppNotificationService', 'Skipping WhatsApp to client: phone not verified');
            }
            return false;
        }

        try {
            const phoneE164 = normalizePhoneToE164(whatsappPhone);
            if (!phoneE164) {
                logWarn('WhatsAppNotificationService', 'Client WhatsApp phone not normalized', { phone: whatsappPhone });
                return false;
            }

            const text = buildWhatsAppText(bookingDetails, notifyType);
            logDebug('WhatsAppNotificationService', 'Sending WhatsApp to client', { phone: phoneE164 });
            await sendWhatsApp({ to: phoneE164, text });
            logDebug('WhatsAppNotificationService', 'WhatsApp to client sent successfully');
            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logError('WhatsAppNotificationService', 'WhatsApp to client failed', {
                error: errorMsg,
                phone: whatsappPhone,
            });
            return false;
        }
    }

    /**
     * Отправляет WhatsApp уведомление мастеру
     */
    async sendToStaff(
        staffData: ParticipantData,
        bookingDetails: BookingDetails,
        notifyType: NotifyType
    ): Promise<boolean> {
        const whatsappPhone = staffData.whatsappPhone;
        if (!this.hasConfig || !whatsappPhone) {
            if (!whatsappPhone) {
                logDebug('WhatsAppNotificationService', 'No staff WhatsApp phone');
            }
            return false;
        }

        try {
            const phoneE164 = normalizePhoneToE164(whatsappPhone);
            if (!phoneE164) {
                logWarn('WhatsAppNotificationService', 'Staff WhatsApp phone not normalized', { phone: whatsappPhone });
                return false;
            }

            const text = buildWhatsAppText(bookingDetails, notifyType);
            logDebug('WhatsAppNotificationService', 'Sending WhatsApp to staff', { phone: phoneE164 });
            await sendWhatsApp({ to: phoneE164, text });
            logDebug('WhatsAppNotificationService', 'WhatsApp to staff sent successfully');
            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logError('WhatsAppNotificationService', 'WhatsApp to staff failed', {
                error: errorMsg,
                phone: whatsappPhone,
            });
            return false;
        }
    }

    /**
     * Отправляет WhatsApp уведомление владельцу
     */
    async sendToOwner(
        ownerData: ParticipantData,
        bookingDetails: BookingDetails,
        notifyType: NotifyType
    ): Promise<boolean> {
        const whatsappPhone = ownerData.whatsappPhone;
        if (!this.hasConfig || !whatsappPhone) {
            if (!whatsappPhone) {
                logDebug('WhatsAppNotificationService', 'No owner WhatsApp phone');
            }
            return false;
        }

        try {
            const phoneE164 = normalizePhoneToE164(whatsappPhone);
            if (!phoneE164) {
                logWarn('WhatsAppNotificationService', 'Owner WhatsApp phone not normalized', { phone: whatsappPhone });
                return false;
            }

            const text = buildWhatsAppText(bookingDetails, notifyType);
            logDebug('WhatsAppNotificationService', 'Sending WhatsApp to owner', { phone: phoneE164 });
            await sendWhatsApp({ to: phoneE164, text });
            logDebug('WhatsAppNotificationService', 'WhatsApp to owner sent successfully');
            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logError('WhatsAppNotificationService', 'WhatsApp to owner failed', {
                error: errorMsg,
                phone: whatsappPhone,
            });
            return false;
        }
    }
}

