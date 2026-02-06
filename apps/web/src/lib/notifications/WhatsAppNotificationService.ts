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
        if (!this.hasConfig || !clientData.phone || !clientData.notifyWhatsApp || !clientData.whatsappVerified) {
            if (!clientData.phone) {
                logDebug('WhatsAppNotificationService', 'No client phone for WhatsApp');
            } else if (!clientData.notifyWhatsApp) {
                logDebug('WhatsAppNotificationService', 'Skipping WhatsApp to client: notifications disabled');
            } else if (!clientData.whatsappVerified) {
                logDebug('WhatsAppNotificationService', 'Skipping WhatsApp to client: phone not verified');
            }
            return false;
        }

        try {
            const phoneE164 = normalizePhoneToE164(clientData.phone);
            if (!phoneE164) {
                logWarn('WhatsAppNotificationService', 'Client phone not normalized', { phone: clientData.phone });
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
                phone: clientData.phone,
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
        if (!this.hasConfig || !staffData.phone) {
            if (!staffData.phone) {
                logDebug('WhatsAppNotificationService', 'No staff phone for WhatsApp');
            }
            return false;
        }

        try {
            const phoneE164 = normalizePhoneToE164(staffData.phone);
            if (!phoneE164) {
                logWarn('WhatsAppNotificationService', 'Staff phone not normalized', { phone: staffData.phone });
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
                phone: staffData.phone,
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
        if (!this.hasConfig || !ownerData.phone) {
            if (!ownerData.phone) {
                logDebug('WhatsAppNotificationService', 'No owner phone for WhatsApp');
            }
            return false;
        }

        try {
            const phoneE164 = normalizePhoneToE164(ownerData.phone);
            if (!phoneE164) {
                logWarn('WhatsAppNotificationService', 'Owner phone not normalized', { phone: ownerData.phone });
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
                phone: ownerData.phone,
            });
            return false;
        }
    }
}

