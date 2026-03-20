import { logError } from '@/lib/log';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

import type { ActiveBookingRow } from './whatsappWebhookTypes';

type CommandHandlers = {
    onRemind: () => Promise<void>;
    onCancel: (bookingId: string | null) => Promise<void>;
    onConfirm: (bookingId: string | null) => Promise<void>;
    onHelp: () => Promise<void>;
    onInfo: (bookingId: string) => Promise<void>;
    formatBookingLine: (booking: ActiveBookingRow, index: number) => string;
};

function parseBookingIndex(message: string, prefix: 'отмена' | 'подтвердить'): number | null {
    const lower = message.toLowerCase().trim();
    const re = prefix === 'отмена'
        ? /отмен(?:а|ить)(?:\s+бронь)?\s*(\d+)/i
        : /подтверди(?:ть)?\s*(\d+)/i;
    const match = lower.match(re);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    return Number.isFinite(n) && n >= 1 ? n : null;
}

function resolveTargetBookingId(activeBookings: ActiveBookingRow[], index: number | null) {
    if (index && index <= activeBookings.length) {
        return activeBookings[index - 1].id;
    }

    if (activeBookings.length === 1) {
        return activeBookings[0].id;
    }

    if (activeBookings.length > 1 && !index) {
        return null;
    }

    return activeBookings[0]?.id ?? null;
}

async function sendMultiBookingPrompt(
    fromPhone: string,
    activeBookings: ActiveBookingRow[],
    action: 'отмена' | 'подтвердить',
    formatBookingLine: CommandHandlers['formatBookingLine']
) {
    const lines = activeBookings.map((b, i) => formatBookingLine(b, i + 1)).join('\n');
    const example = action === 'отмена' ? 'отмена 1' : 'подтвердить 1';
    await sendWhatsApp({
        to: fromPhone,
        text: `У вас несколько бронирований:\n\n${lines}\n\nНапишите «${example}» или другой номер из списка.`,
    });
}

export async function handleWhatsAppTextCommand(
    messageText: string,
    fromPhone: string,
    activeBookings: ActiveBookingRow[],
    handlers: CommandHandlers
) {
    try {
        const lowerText = messageText.toLowerCase().trim();
        const bookingId = activeBookings[0]?.id ?? null;

        const remindCommands = ['напомни', 'напомни мне', 'remind', 'мои записи', 'мои брони'];
        if (remindCommands.some(cmd => lowerText.includes(cmd))) {
            await handlers.onRemind();
            return;
        }

        const cancelCommands = ['отмена', 'cancel', 'отменить', 'отменить бронь', 'отменить запись'];
        if (cancelCommands.some(cmd => lowerText.includes(cmd))) {
            const index = parseBookingIndex(messageText, 'отмена');
            const targetId = resolveTargetBookingId(activeBookings, index);
            if (activeBookings.length > 1 && !index) {
                await sendMultiBookingPrompt(fromPhone, activeBookings, 'отмена', handlers.formatBookingLine);
                return;
            }
            await handlers.onCancel(targetId);
            return;
        }

        const confirmCommands = ['подтвердить', 'confirm', 'да', 'подтверждаю', 'ок', 'ok'];
        if (confirmCommands.some(cmd => lowerText.includes(cmd))) {
            const index = parseBookingIndex(messageText, 'подтвердить');
            const targetId = resolveTargetBookingId(activeBookings, index);
            if (activeBookings.length > 1 && !index) {
                await sendMultiBookingPrompt(fromPhone, activeBookings, 'подтвердить', handlers.formatBookingLine);
                return;
            }
            await handlers.onConfirm(targetId);
            return;
        }

        const helpCommands = ['помощь', 'help', 'команды', 'commands', 'что можно', '?'];
        if (helpCommands.some(cmd => lowerText.includes(cmd))) {
            await handlers.onHelp();
            return;
        }

        if (bookingId) {
            await handlers.onInfo(bookingId);
        }
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling text command', { error, messageText, fromPhone });
    }
}
