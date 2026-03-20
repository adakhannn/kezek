import { renderToStaticMarkup } from 'react-dom/server';

import { StaffReviewsSection } from '@/app/dashboard/staff/[id]/StaffReviewsSection';
import type { Review } from '@/app/dashboard/staff/[id]/staffDetailTypes';

describe('staff reviews section', () => {
    const t = (_key: string, fallback: string) => fallback;

    test('renders empty state when there are no reviews', () => {
        const html = renderToStaticMarkup(<StaffReviewsSection reviews={[]} t={t} />);

        expect(html).toContain('Отзывы');
        expect(html).toContain('Пока нет отзывов');
    });

    test('renders review details and service name', () => {
        const reviews: Review[] = [
            {
                id: 'review-1',
                rating: 5,
                comment: 'Все понравилось',
                created_at: '2026-03-20T08:00:00.000Z',
                booking_id: 'booking-1',
                service_name: 'Маникюр',
                start_at: '2026-03-20T08:00:00.000Z',
                end_at: '2026-03-20T09:00:00.000Z',
                client_name: 'Алина',
                client_phone: '+996500000001',
            },
        ];

        const html = renderToStaticMarkup(<StaffReviewsSection reviews={reviews} t={t} />);

        expect(html).toContain('Маникюр');
        expect(html).toContain('Все понравилось');
        expect(html).toContain('Алина');
        expect(html).toContain('5');
    });
});
