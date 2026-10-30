import { bookingRu } from '@/app/_components/i18n/dictionaries/booking.ru';
import { bookingKy } from '@/app/_components/i18n/dictionaries/booking.ky';
import { bookingEn } from '@/app/_components/i18n/dictionaries/booking.en';

test.each([
    ['ru', bookingRu, 'без регистрации', 'имя и телефон'],
    ['ky', bookingKy, 'катталбастан', 'телефонуңуз'],
    ['en', bookingEn, 'without registration', 'name and phone'],
] as const)('guest booking notice describes the account-free path in %s', (_locale, dictionary, guest, contacts) => {
    expect(dictionary['booking.needAuth']).toContain(guest);
    expect(dictionary['booking.needAuth']).toContain(contacts);
});
