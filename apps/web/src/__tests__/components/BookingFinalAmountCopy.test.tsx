/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import BookingCard from '@/app/cabinet/components/BookingCard';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/cabinet/components/MapDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/cabinet/components/ReviewDialog', () => ({ __esModule: true, default: () => null }));

const cases = [
    ['ru', ru, 'Итоговая сумма:'],
    ['en', en, 'Final amount:'],
    ['ky', ky, 'Жыйынтык сумма:'],
] as const;

describe.each(cases)('booking final amount copy %s', (locale, dictionary, label) => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) => dictionary[key] ?? ru[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
    });

    function renderAmount(amount: number, kind: 'package' | 'promotion' = 'package') {
        render(<BookingCard bookingId="fixture-amount" status="paid" start_at="2026-10-12T11:00:00Z" end_at="2026-10-12T12:00:00Z" service={null} staff={null} branch={null} business={null} canCancel={false}
            subscriptionApplied={kind === 'package' ? { plan_id: 'fixture-plan', plan_name_ru: 'Fixture package', final_amount: amount } : null}
            promotionApplied={kind === 'promotion' ? { promotion_type: 'discount', promotion_title: 'Fixture promotion', final_amount: amount } : null} />);
    }

    it('defines its own locale label instead of falling back to Russian', () => {
        expect(dictionary['cabinet.bookings.card.finalAmount']).toBe(label);
    });

    it.each([200, 0])('renders the unchanged package amount %s with the localized label', amount => {
        renderAmount(amount);
        expect(screen.getByText(`${label} ${amount} ${dictionary['booking.currency']}`)).toBeTruthy();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('uses the same localized key in the promotion display', () => {
        renderAmount(200, 'promotion');
        expect(screen.getByText(`${label} 200 ${dictionary['booking.currency']}`)).toBeTruthy();
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
