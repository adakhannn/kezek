import { bishkekDayRange, fmtTimeBishkek, mapTodayBookings, normRel } from '@/app/admin/adminUtils';
import type { BookingRel } from '@/app/admin/adminTypes';

describe('adminUtils', () => {
    test('normRel returns first item for array relations', () => {
        expect(normRel([{ value: 1 }, { value: 2 }])).toEqual({ value: 1 });
        expect(normRel({ value: 3 })).toEqual({ value: 3 });
        expect(normRel(null)).toBeNull();
        expect(normRel(undefined)).toBeNull();
    });

    test('mapTodayBookings normalizes nested relations and fallbacks', () => {
        const rows: BookingRel[] = [
            {
                id: 'booking-1',
                start_at: '2026-03-20T06:00:00.000Z',
                end_at: '2026-03-20T07:00:00.000Z',
                status: 'confirmed',
                client_name: 'Alice',
                client_phone: '+996500000001',
                services: [{ name_ru: 'Маникюр' }],
                staff: [{ full_name: 'Мастер 1' }],
                businesses: [{ id: 'biz-1', name: 'Salon A', slug: 'salon-a' }],
                branches: [{ name: 'Branch 1' }],
            },
            {
                id: 'booking-2',
                start_at: '2026-03-20T08:00:00.000Z',
                end_at: '2026-03-20T09:00:00.000Z',
                status: 'hold',
                client_name: null,
                client_phone: null,
                services: null,
                staff: null,
                businesses: null,
                branches: null,
            },
        ];

        expect(mapTodayBookings(rows)).toEqual([
            {
                id: 'booking-1',
                start_at: '2026-03-20T06:00:00.000Z',
                end_at: '2026-03-20T07:00:00.000Z',
                status: 'confirmed',
                client: 'Alice',
                service: 'Маникюр',
                staff: 'Мастер 1',
                biz: 'Salon A',
                bizId: 'biz-1',
                branch: 'Branch 1',
            },
            {
                id: 'booking-2',
                start_at: '2026-03-20T08:00:00.000Z',
                end_at: '2026-03-20T09:00:00.000Z',
                status: 'hold',
                client: '—',
                service: '—',
                staff: '—',
                biz: '—',
                bizId: null,
                branch: '—',
            },
        ]);
    });

    test('fmtTimeBishkek formats time in Asia/Bishkek timezone', () => {
        expect(fmtTimeBishkek('2026-03-20T06:05:00.000Z')).toBe('12:05');
    });

    test('bishkekDayRange returns same-day ISO boundaries and label', () => {
        const result = bishkekDayRange();

        expect(result.label).toMatch(/^\d{2}\/\d{2}\/\d{4}$|^\d{4}-\d{2}-\d{2}$/);
        expect(result.startISO).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(result.endISO).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(new Date(result.endISO).getTime() - new Date(result.startISO).getTime()).toBe(24 * 60 * 60 * 1000);
    });
});
