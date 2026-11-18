import { NameReminderBanner } from './NameReminderBanner';
import { TelegramReminderBanner } from './TelegramReminderBanner';

import { getShellViewer } from '@/lib/shellViewer';

/**
 * Shows at most one reminder: a missing profile name first, then Telegram notifications. The
 * decision uses the viewer the header already read on the server; profile saves and Telegram
 * linking refresh the router, sign-in and sign-out refresh it through AuthStatusUpdater.
 */
export async function ReminderBanners() {
    const viewer = await getShellViewer();
    if (viewer.status !== 'signed-in') return null;
    if (viewer.reminder === 'name') return <NameReminderBanner />;
    if (viewer.reminder === 'telegram') return <TelegramReminderBanner key={viewer.userId} userId={viewer.userId} />;
    return null;
}
