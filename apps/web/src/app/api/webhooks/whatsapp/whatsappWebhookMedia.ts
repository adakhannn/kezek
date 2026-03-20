import { logDebug, logError } from '@/lib/log';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

import type { WhatsAppMessage } from './whatsappWebhookTypes';

export async function handleWhatsAppMediaMessage(
    message: WhatsAppMessage,
    fromPhone: string,
    bookingId: string | null,
    _bizId: string | null
) {
    try {
        const mediaType = message.type;
        let mediaInfo = '';

        switch (mediaType) {
            case 'image':
                mediaInfo = `Изображение${message.image?.caption ? `: ${message.image.caption}` : ''}`;
                break;
            case 'audio':
                mediaInfo = 'Аудио сообщение';
                break;
            case 'video':
                mediaInfo = `Видео${message.video?.caption ? `: ${message.video.caption}` : ''}`;
                break;
            case 'document':
                mediaInfo = `Документ: ${message.document?.filename || 'без имени'}`;
                break;
            default:
                mediaInfo = `Медиа-файл (${mediaType})`;
        }

        logDebug('WhatsAppWebhook', 'Media message received', {
            type: mediaType,
            fromPhone,
            bookingId,
            mediaInfo,
        });

        try {
            await sendWhatsApp({
                to: fromPhone,
                text: `Получен ${mediaInfo}. Спасибо! Мы обработаем ваше сообщение.`,
            });
        } catch (error) {
            logError('WhatsAppWebhook', 'Failed to send media confirmation', { error, fromPhone });
        }
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling media message', { error, messageId: message.id });
    }
}
