// apps/web/src/lib/notifications/TelegramNotificationService.ts

import { buildTelegramText } from './messageBuilders';
import type { ParticipantData, BookingDetails, NotifyType } from './types';

import { logDebug, logError, logWarn } from '@/lib/log';
import { sendTelegram } from '@/lib/senders/telegram';

export class TelegramNotificationService {
    private readonly hasConfig: boolean;

    constructor() {
        this.hasConfig = !!process.env.TELEGRAM_BOT_TOKEN;
        if (!this.hasConfig) {
            logWarn('TelegramNotificationService', 'Telegram not configured: missing TELEGRAM_BOT_TOKEN');
        }
    }

    /**
     * Отправляет Telegram уведомление клиенту
     */
    async sendToClient(
        clientData: ParticipantData,
        bookingDetails: BookingDetails,
        notifyType: NotifyType
    ): Promise<boolean> {
        if (!this.hasConfig || !clientData.telegramId || !clientData.notifyTelegram || !clientData.telegramVerified) {
            if (!clientData.telegramId) {
                logDebug('TelegramNotificationService', 'No client telegram_id for Telegram');
            } else if (!clientData.notifyTelegram) {
                logDebug('TelegramNotificationService', 'Skipping Telegram to client: notifications disabled');
            } else if (!clientData.telegramVerified) {
                logDebug('TelegramNotificationService', 'Skipping Telegram to client: telegram not verified');
            }
            return false;
        }

        try {
            const text = buildTelegramText(bookingDetails, notifyType);
            logDebug('TelegramNotificationService', 'Sending Telegram to client', { chatId: clientData.telegramId });
            await sendTelegram({ chatId: clientData.telegramId, text });
            logDebug('TelegramNotificationService', 'Telegram to client sent successfully');
            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logError('TelegramNotificationService', 'Telegram to client failed', {
                error: errorMsg,
                chatId: clientData.telegramId,
            });
            return false;
        }
    }

    /**
     * Отправляет Telegram уведомление мастеру
     * Для мастера отправляем даже если telegram не верифицирован (для служебных уведомлений это допустимо)
     */
    async sendToStaff(
        staffData: ParticipantData,
        bookingDetails: BookingDetails,
        notifyType: NotifyType
    ): Promise<boolean> {
        if (!this.hasConfig || !staffData.telegramId || !staffData.notifyTelegram) {
            if (!staffData.telegramId) {
                logDebug('TelegramNotificationService', 'No staff telegram_id for Telegram');
            } else if (!staffData.notifyTelegram) {
                logDebug('TelegramNotificationService', 'Skipping Telegram to staff: notifications disabled');
            }
            return false;
        }

        try {
            const text = buildTelegramText(bookingDetails, notifyType);
            logDebug('TelegramNotificationService', 'Sending Telegram to staff', { 
                chatId: staffData.telegramId,
                verified: staffData.telegramVerified 
            });
            await sendTelegram({ chatId: staffData.telegramId, text });
            logDebug('TelegramNotificationService', 'Telegram to staff sent successfully');
            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logError('TelegramNotificationService', 'Telegram to staff failed', {
                error: errorMsg,
                chatId: staffData.telegramId,
            });
            return false;
        }
    }

    /**
     * Отправляет Telegram уведомление владельцу
     * Для владельца отправляем даже если telegram не верифицирован (для служебных уведомлений это допустимо)
     */
    async sendToOwner(
        ownerData: ParticipantData,
        bookingDetails: BookingDetails,
        notifyType: NotifyType
    ): Promise<boolean> {
        if (!this.hasConfig || !ownerData.telegramId || !ownerData.notifyTelegram) {
            if (!ownerData.telegramId) {
                logDebug('TelegramNotificationService', 'No owner telegram_id for Telegram');
            } else if (!ownerData.notifyTelegram) {
                logDebug('TelegramNotificationService', 'Skipping Telegram to owner: notifications disabled');
            }
            return false;
        }

        try {
            const text = buildTelegramText(bookingDetails, notifyType);
            logDebug('TelegramNotificationService', 'Sending Telegram to owner', { 
                chatId: ownerData.telegramId,
                verified: ownerData.telegramVerified 
            });
            await sendTelegram({ chatId: ownerData.telegramId, text });
            logDebug('TelegramNotificationService', 'Telegram to owner sent successfully');
            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logError('TelegramNotificationService', 'Telegram to owner failed', {
                error: errorMsg,
                chatId: ownerData.telegramId,
            });
            return false;
        }
    }
}

