import { bookingCountForm } from '@/lib/bookingCountForm';

test.each([[0, 'many'], [1, 'one'], [2, 'few'], [4, 'few'], [5, 'many'], [11, 'many'], [12, 'many'], [14, 'many'], [21, 'one'], [22, 'few'], [25, 'many'], [101, 'one'], [111, 'many']] as const)
    ('Russian booking count %i uses %s', (count, form) => expect(bookingCountForm(count, 'ru')).toBe(form));
test.each(['en', 'ky'] as const)('%s handles singular and general plural', locale => {
    expect(bookingCountForm(1, locale)).toBe('one');
    expect(bookingCountForm(0, locale)).toBe('many');
    expect(bookingCountForm(21, locale)).toBe('many');
});
