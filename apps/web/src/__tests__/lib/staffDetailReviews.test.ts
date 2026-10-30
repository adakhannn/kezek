import { projectStaffDetailReviews, type StaffReviewBooking } from '@/lib/staffDetailReviews';

const review = { id:'review', rating:3, comment:null, created_at:'2026-10-13T00:00:00Z' };
const booking: StaffReviewBooking = { id:'booking', start_at:'start', end_at:'end', client_name:'LIVE TEST', client_phone:null, reviews:review, services:{ name_ru:'RU' } };

test('projects a to-one review without mutating the joined source', () => {
    const result = projectStaffDetailReviews([booking]);
    expect(result).toEqual([{ ...review, booking_id:'booking', service_name:'RU', start_at:'start', end_at:'end', client_name:'LIVE TEST', client_phone:null }]);
    expect(booking.reviews).toBe(review);
    expect(result[0]).not.toBe(review);
});

test.each([null, undefined, []])('accepts an empty review relation %p', (reviews) => {
    expect(projectStaffDetailReviews([{ ...booking, reviews }])).toEqual([]);
});

test('supports legacy arrays, retains null comments and sorts across bookings newest-first', () => {
    const older = {...review, id:'older', created_at:'2026-10-12T00:00:00Z'};
    const original = [older, review];
    const result = projectStaffDetailReviews([{...booking, id:'b1', reviews:original}, {...booking, id:'b2', reviews:{...review, id:'latest', created_at:'2026-10-14T00:00:00Z'}}]);
    expect(result.map(item => item.id)).toEqual(['latest', 'review', 'older']);
    expect(original.map(item => item.id)).toEqual(['older', 'review']);
});

test.each([
    [{ name_ru:'RU', name_ky:'KY', name_en:'EN' }, 'KY'],
    [{ name_ru:'RU', name_ky:'', name_en:'EN' }, 'EN'],
    [[{ name_ru:'RU' }], 'RU'],
    [null, null],
    [[], null],
] as const)('preserves existing service projection for %p', (services, expected) => {
    expect(projectStaffDetailReviews([{...booking, services:services as StaffReviewBooking['services']}])[0].service_name).toBe(expected);
});
