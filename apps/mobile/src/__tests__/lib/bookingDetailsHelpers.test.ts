import { branchDirectionsUrl, branchMapUrl, canShowOnMap } from '../../lib/branchMap';
import { classifyBookingDetailsError, offlineBookingToDetails } from '../../screens/bookingDetails/bookingDetailsLoad';
import { buildTimelineSteps } from '../../screens/bookingDetails/types';

describe('branchMap', () => {
    const place = { lat: 42.87, lon: 74.59, address: 'Чуй 1', name: 'Центр' };

    test('coordinates open Apple Maps on iOS and Google Maps elsewhere', () => {
        expect(branchMapUrl(place, 'ios')).toBe('https://maps.apple.com/?ll=42.87,74.59&q=%D0%A6%D0%B5%D0%BD%D1%82%D1%80');
        expect(branchMapUrl(place, 'android')).toBe('https://www.google.com/maps/search/?api=1&query=42.87%2C74.59');
        expect(branchDirectionsUrl(place, 'ios')).toBe('https://maps.apple.com/?daddr=42.87%2C74.59');
        expect(branchDirectionsUrl(place, 'android')).toBe('https://www.google.com/maps/dir/?api=1&destination=42.87%2C74.59');
    });

    test('without coordinates the address is searched; without either there is no map', () => {
        expect(branchMapUrl({ address: 'Чуй 1' }, 'android')).toContain(encodeURIComponent('Чуй 1'));
        expect(canShowOnMap({ address: '  ' })).toBe(false);
        expect(canShowOnMap({ lat: 200, lon: 10 })).toBe(false);
        expect(branchDirectionsUrl({}, 'ios')).toBeNull();
        expect(canShowOnMap(null)).toBe(false);
    });
});

describe('booking details load (B4)', () => {
    const withStatus = (status?: number) => Object.assign(new Error('x'), { status });

    test.each([
        [404, 'not_found'],
        [403, 'not_found'],
        [undefined, 'transient'],
        [500, 'transient'],
        [503, 'transient'],
        [429, 'transient'],
        [401, 'error'],
        [400, 'error'],
    ])('status %p is %p', (status, kind) => {
        expect(classifyBookingDetailsError(withStatus(status))).toBe(kind);
    });

    test('the offline copy carries no ids, so no actions can start from it', () => {
        const details = offlineBookingToDetails({
            id: 'b', status: 'confirmed', start_at: 's', end_at: 'e', service_name: 'Стрижка', business_name: 'Салон', business_tz: 'Asia/Almaty', created_at: 'x',
        });
        expect(details).toMatchObject({ id: 'b', viewer_role: 'client', service: { name_ru: 'Стрижка' }, business: { name: 'Салон', tz: 'Asia/Almaty' } });
        expect(details.biz_id).toBeUndefined();
        expect(details.staff_id).toBeUndefined();
    });
});

describe('timeline (B6)', () => {
    test('the promo step appears only with a promotion and is done once paid', () => {
        expect(buildTimelineSteps('confirmed').map((step) => step.key)).toEqual(['created', 'confirmed', 'completed']);
        expect(buildTimelineSteps('confirmed', true).find((step) => step.key === 'promo')).toMatchObject({ done: false });
        expect(buildTimelineSteps('paid', true).find((step) => step.key === 'promo')).toMatchObject({ done: true });
        expect(buildTimelineSteps('cancelled', true).some((step) => step.key === 'promo')).toBe(false);
    });
});
