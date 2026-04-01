import { logDebug, logError } from '@/lib/log';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

type WhatsAppMessage = {
    id: string;
    type: string;
    image?: { caption?: string };
    audio?: { mime_type?: string };
    video?: { caption?: string };
    document?: { filename?: string };
};

type WhatsAppStatus = {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    recipient_id: string;
};

function describeMediaMessage(message: WhatsAppMessage): string {
    switch (message.type) {
        case 'image':
            return `Изображение${message.image?.caption ? `: ${message.image.caption}` : ''}`;
        case 'audio':
            return 'Аудио сообщение';
        case 'video':
            return `Видео${message.video?.caption ? `: ${message.video.caption}` : ''}`;
        case 'document':
            return `Документ: ${message.document?.filename || 'без имени'}`;
        default:
            return `Медиа-файл (${message.type})`;
    }
}

export async function handleIncomingWhatsAppMediaMessage(
    message: WhatsAppMessage,
    fromPhone: string,
    bookingId: string | null,
): Promise<void> {
    try {
        const mediaInfo = describeMediaMessage(message);

        logDebug('WhatsAppWebhook', 'Media message received', {
            type: message.type,
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
            logError('WhatsAppWebhook', 'Failed to send media confirmation', {
                error,
                fromPhone,
            });
        }
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling media message', {
            error,
            messageId: message.id,
        });
    }
}

export function logWhatsAppStatusUpdate(status: WhatsAppStatus): void {
    logDebug('WhatsAppWebhook', 'Message status updated', {
        messageId: status.id,
        status: status.status,
        recipientId: status.recipient_id,
    });
}
