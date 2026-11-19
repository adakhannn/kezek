import { fmtErr } from '@/app/b/[slug]/utils';
import { bookingEn } from '@/app/_components/i18n/dictionaries/booking.en';

// The fallback text of t('key', 'Текст'), as without a dictionary.
const russian = (_key: string, fallback?: string) => fallback ?? _key;

describe('fmtErr on the public booking page', () => {
    it('shows clients the message without database details, hints or codes', () => {
        const text = fmtErr({
            message: 'Не удалось создать запись',
            details: 'Key (staff_id, time_range) conflicts with existing key',
            hint: 'Check the no_overlap constraint',
            code: '23P01',
        }, russian);

        expect(text).toBe('Не удалось создать запись');
        expect(text).not.toMatch(/Details|Hint|Code|no_overlap|23P01/);
    });

    it('keeps the friendly texts for known business errors', () => {
        expect(fmtErr({ code: 'booking_slot_unavailable', message: 'x' }, russian)).toBe('Это время уже занято. Выберите другой свободный слот.');
        expect(fmtErr({ message: 'staff is not assigned to branch' }, russian)).toContain('мастер не прикреплён');
    });

    it('shows the known business errors in the UI language', () => {
        const english = (key: string) => (bookingEn as Record<string, string>)[key];
        expect(fmtErr({ message: 'staff is not assigned to branch' }, english)).toBe(bookingEn['booking.error.masterNotAssigned']);
    });
});
