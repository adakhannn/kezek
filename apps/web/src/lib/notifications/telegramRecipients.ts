import type { ParticipantData } from './types';

type TelegramRecipient = { role: 'client' | 'staff' | 'owner'; data: ParticipantData };

/** Identical booking messages target a chat, not a role. Filter eligibility before deduplicating. */
export function uniqueTelegramRecipients(
    client: ParticipantData,
    staff: ParticipantData,
    owner: ParticipantData,
): TelegramRecipient[] {
    const seen = new Set<number>();
    const recipients: TelegramRecipient[] = [
        { role: 'client', data: client },
        { role: 'staff', data: staff },
        { role: 'owner', data: owner },
    ];
    return recipients.filter(({ role, data }) => {
        if (!data.telegramId || !data.notifyTelegram ||
            (role === 'client' && !data.telegramVerified) || seen.has(data.telegramId)) return false;
        // Staff/owner eligibility matches their existing notification service policy.
        seen.add(data.telegramId);
        return true;
    });
}
