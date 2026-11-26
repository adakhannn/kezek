import { createTranslate } from '../../i18n';
import {
    buildBookingPayload,
    describePromotion,
    filterStaffForServices,
    pickSelectedServices,
    staffForBranch,
    summarizeServices,
    temporaryTransfersOf,
    validateGuestContacts,
} from '../../screens/booking/bookingSelection';
import { businessDayBounds } from '../../screens/booking/useClientDayBookings';

const ru = createTranslate('ru');

describe('several services (C3)', () => {
    const services = [
        { id: 'cut', duration_min: 30, price_from: 500, price_to: null },
        { id: 'color', duration_min: 90, price_from: 1500, price_to: 2000 },
    ];

    test('keeps the chosen order and adds durations and prices', () => {
        const chosen = pickSelectedServices(services, ['color', 'cut', 'gone']);
        expect(chosen.map((service) => service.id)).toEqual(['color', 'cut']);
        expect(summarizeServices(chosen)).toEqual({ durationMin: 120, price_from: 2000, price_to: 2000 });
    });

    test('offers only masters who perform every chosen service', () => {
        const staff = [{ id: 'a' }, { id: 'b' }];
        const links = [
            { service_id: 'cut', staff_id: 'a' },
            { service_id: 'color', staff_id: 'a' },
            { service_id: 'cut', staff_id: 'b' },
        ];
        expect(filterStaffForServices(staff, links, ['cut', 'color'])).toEqual([{ id: 'a' }]);
        expect(filterStaffForServices(staff, links, ['cut'])).toEqual(staff);
        expect(filterStaffForServices(staff, [], ['cut', 'color'])).toEqual(staff);
    });

    test('one service goes as service_id, several as services[] with catalogue durations', () => {
        const base = { bizId: 'biz', branchId: 'br', staffId: 'st', startAt: '2035-01-01T10:00:00Z' };
        expect(buildBookingPayload({ ...base, services: [services[0]] })).toEqual({
            biz_id: 'biz', branch_id: 'br', staff_id: 'st', start_at: '2035-01-01T10:00:00Z', service_id: 'cut',
        });
        expect(buildBookingPayload({ ...base, services: [services[1], services[0]] })).toEqual({
            biz_id: 'biz',
            branch_id: 'br',
            staff_id: 'st',
            start_at: '2035-01-01T10:00:00Z',
            services: [
                { service_id: 'color', duration_min: 90, order_index: 0 },
                { service_id: 'cut', duration_min: 30, order_index: 1 },
            ],
        });
    });
});

describe('masters working at another branch (C5)', () => {
    const staff = [
        { id: 'home', branch_id: 'main' },
        { id: 'visitor', branch_id: 'other' },
        { id: 'stranger', branch_id: 'other' },
    ];
    const locations = [
        { staff_id: 'visitor', branch_id: 'main', date_on: '2035-01-02' },
        { staff_id: 'home', branch_id: 'other', date_on: '2035-01-03' },
        { staff_id: 'home', branch_id: 'main', date_on: '2035-01-04' },
    ];

    test('the branch offers its own masters and those visiting it on a booking day', () => {
        expect(staffForBranch(staff, 'main', locations).map((person) => person.id)).toEqual(['home', 'visitor']);
        expect(staffForBranch(staff, 'main', []).map((person) => person.id)).toEqual(['home']);
    });

    test('only days away from the home branch are transfers', () => {
        expect(temporaryTransfersOf(locations, staff)).toEqual([
            { staff_id: 'visitor', branch_id: 'main', date: '2035-01-02' },
            { staff_id: 'home', branch_id: 'other', date: '2035-01-03' },
        ]);
    });
});

describe('promotion note and guest form', () => {
    test('describes promotions as the website summary does', () => {
        expect(describePromotion({ promotion_type: 'free_after_n_visits', title_ru: null, params: { visit_count: 5 } }, ru))
            .toBe('Каждая 5-я услуга бесплатно');
        expect(describePromotion({ promotion_type: 'birthday_discount', title_ru: null, params: { discount_percent: 15 } }, ru))
            .toBe('Скидка 15%');
        expect(describePromotion({ promotion_type: 'custom', title_ru: 'Осенняя акция', params: null }, ru)).toBe('Осенняя акция');
        expect(describePromotion({ promotion_type: 'custom', title_ru: null, params: null }, ru))
            .toBe('Доступно специальное предложение');
    });

    test('the guest needs a name and an E.164 phone; email is optional', () => {
        const ok = { name: 'Айбек', phone: '+996555123456', email: '' };
        expect(validateGuestContacts(ok)).toBeNull();
        expect(validateGuestContacts({ ...ok, name: ' ' })).toBe('booking.guest.nameRequired');
        expect(validateGuestContacts({ ...ok, name: 'A' })).toBe('booking.guest.nameInvalid');
        expect(validateGuestContacts({ ...ok, phone: '' })).toBe('booking.guest.phoneRequired');
        expect(validateGuestContacts({ ...ok, phone: '0555123456' })).toBe('booking.guest.phoneInvalid');
        expect(validateGuestContacts({ ...ok, email: 'nope' })).toBe('booking.guest.emailInvalid');
        expect(validateGuestContacts({ ...ok, email: 'a@b.kg' })).toBeNull();
    });
});

test('a business day is bounded in the business zone (C8)', () => {
    const { start, end } = businessDayBounds('2035-01-01', 'Asia/Bishkek');
    expect(start.toISOString()).toBe('2034-12-31T18:00:00.000Z');
    expect(end.toISOString()).toBe('2035-01-01T18:00:00.000Z');
});
