import {
    getBookingServiceName,
    getBookingStaffName,
    getBookingStatusMeta,
} from '@/app/cabinet/components/bookingCardHelpers';

const t = (_key: string, fallback?: string) => fallback || '';

describe('bookingCardHelpers', () => {
    it('selects service name by locale', () => {
        const service = { name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: 'Haircut' };
        expect(getBookingServiceName(service, 'ru', t)).toBe('Стрижка');
        expect(getBookingServiceName(service, 'ky', t)).toBe('Чач кыркуу');
        expect(getBookingServiceName(service, 'en', t)).toBe('Haircut');
    });

    it('returns fallback staff label when name is absent', () => {
        expect(getBookingStaffName(null, 'ru', t)).toBe('Мастер не указан');
    });

    it('builds status meta with human label', () => {
        expect(getBookingStatusMeta('confirmed', t).label).toBe('Подтверждена');
        expect(getBookingStatusMeta('cancelled', t).dotColor).toBe('bg-red-500');
    });
});
