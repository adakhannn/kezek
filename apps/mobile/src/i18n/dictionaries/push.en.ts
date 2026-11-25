import type { pushRu } from './push.ru';

export const pushEn: Record<keyof typeof pushRu, string> = {
    'push.switch.label': 'Push notifications',
    'push.switch.hint': 'Booking confirmations, cancellations and reminders on this phone',
    'push.denied.title': 'Notifications are off',
    'push.denied.message': 'Allow notifications for Kezek in your phone settings.',
    'push.denied.openSettings': 'Open settings',
    'push.unsupported': 'Push notifications work only in the Kezek app on a phone.',
    'push.error': "Couldn't change the setting. Check your connection and try again.",
};
