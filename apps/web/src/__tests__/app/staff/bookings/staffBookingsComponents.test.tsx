import { renderToStaticMarkup } from 'react-dom/server';

import { StaffBookingCard } from '@/app/staff/bookings/StaffBookingCard';
import { StaffBookingsTabs } from '@/app/staff/bookings/StaffBookingsTabs';
import type { Booking } from '@/app/staff/bookings/staffBookingsTypes';

describe('staff bookings components', () => {
    const t = (_key: string, fallback: string) => fallback;

    test('StaffBookingsTabs renders counters and active tab label', () => {
        const html = renderToStaticMarkup(
            <StaffBookingsTabs
                tab="upcoming"
                setTab={() => {}}
                upcomingCount={3}
                pastCount={5}
                t={t}
            />
        );

        expect(html).toContain('Предстоящие');
        expect(html).toContain('(3)');
        expect(html).toContain('(5)');
        expect(html).toContain('Создать запись');
    });

    test('StaffBookingCard renders normalized booking info and status', () => {
        const booking: Booking = {
            id: 'booking-1',
            status: 'confirmed',
            start_at: '2026-03-20T08:00:00.000Z',
            end_at: '2026-03-20T09:00:00.000Z',
            client_name: 'Алина',
            client_phone: '+996500000001',
            services: [{ name_ru: 'Маникюр', duration_min: 60 }],
            branches: [{ name: 'Центр', lat: null, lon: null, address: null }],
            businesses: [{ id: 'biz-1', name: 'Salon A', slug: 'salon-a' }],
        };

        const html = renderToStaticMarkup(<StaffBookingCard booking={booking} locale="ru" t={t} />);

        expect(html).toContain('Маникюр');
        expect(html).toContain('Алина');
        expect(html).toContain('+996500000001');
        expect(html).toContain('Центр');
        expect(html).toContain('Salon A');
        expect(html).toContain('Подтверждено');
        expect(html).toContain('Подробнее');
    });

    test('StaffBookingCard falls back to phone and default placeholders', () => {
        const booking: Booking = {
            id: 'booking-2',
            status: 'custom_status',
            start_at: '2026-03-20T10:00:00.000Z',
            end_at: '2026-03-20T11:00:00.000Z',
            client_name: null,
            client_phone: '+996500000002',
            services: null,
            branches: null,
            businesses: null,
        };

        const html = renderToStaticMarkup(<StaffBookingCard booking={booking} locale="ru" t={t} />);

        expect(html).toContain('Услуга');
        expect(html).toContain('+996500000002');
        expect(html).toContain('Филиал');
        expect(html).toContain('Бизнес');
        expect(html).toContain('custom_status');
    });
});
