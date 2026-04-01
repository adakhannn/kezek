export type WhatsAppTextCommandKind =
    | 'remind'
    | 'cancel'
    | 'confirm'
    | 'help'
    | 'booking_info';

export type WhatsAppTextCommandRoute = {
    kind: WhatsAppTextCommandKind;
    bookingIndex: number | null;
    requiresBookingChoice: boolean;
};

const remindCommands = ['напомни', 'напомни мне', 'remind', 'мои записи', 'мои брони'];
const cancelCommands = ['отмена', 'cancel', 'отменить', 'отменить бронь', 'отменить запись'];
const confirmCommands = ['подтвердить', 'confirm', 'да', 'подтверждаю', 'ок', 'ok'];
const helpCommands = ['помощь', 'help', 'команды', 'commands', 'что можно', '?'];

function includesAnyCommand(messageText: string, commands: string[]): boolean {
    const lowerText = messageText.toLowerCase().trim();
    return commands.some((command) => lowerText.includes(command));
}

export function parseBookingIndex(messageText: string, kind: 'cancel' | 'confirm'): number | null {
    const lowerText = messageText.toLowerCase().trim();
    const regex =
        kind === 'cancel'
            ? /отмен(?:а|ить)(?:\s+бронь)?\s*(\d+)/i
            : /подтверди(?:ть)?\s*(\d+)/i;
    const match = lowerText.match(regex);

    if (!match) {
        return null;
    }

    const parsed = parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
}

function resolveBookingCommand(
    kind: 'cancel' | 'confirm',
    messageText: string,
    activeBookingsCount: number,
): WhatsAppTextCommandRoute {
    const bookingNumber = parseBookingIndex(messageText, kind);

    if (bookingNumber && bookingNumber <= activeBookingsCount) {
        return {
            kind,
            bookingIndex: bookingNumber - 1,
            requiresBookingChoice: false,
        };
    }

    if (activeBookingsCount === 1) {
        return {
            kind,
            bookingIndex: 0,
            requiresBookingChoice: false,
        };
    }

    if (activeBookingsCount > 1 && !bookingNumber) {
        return {
            kind,
            bookingIndex: null,
            requiresBookingChoice: true,
        };
    }

    return {
        kind,
        bookingIndex: activeBookingsCount > 0 ? 0 : null,
        requiresBookingChoice: false,
    };
}

export function routeWhatsAppTextCommand(
    messageText: string,
    activeBookingsCount: number,
): WhatsAppTextCommandRoute {
    if (includesAnyCommand(messageText, remindCommands)) {
        return {
            kind: 'remind',
            bookingIndex: activeBookingsCount > 0 ? 0 : null,
            requiresBookingChoice: false,
        };
    }

    if (includesAnyCommand(messageText, cancelCommands)) {
        return resolveBookingCommand('cancel', messageText, activeBookingsCount);
    }

    if (includesAnyCommand(messageText, confirmCommands)) {
        return resolveBookingCommand('confirm', messageText, activeBookingsCount);
    }

    if (includesAnyCommand(messageText, helpCommands)) {
        return {
            kind: 'help',
            bookingIndex: null,
            requiresBookingChoice: false,
        };
    }

    return {
        kind: 'booking_info',
        bookingIndex: activeBookingsCount > 0 ? 0 : null,
        requiresBookingChoice: false,
    };
}
