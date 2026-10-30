/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { BookingSummary } from '@/app/b/[slug]/components/BookingSummary';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));

const props = {
    branchName: 'Fixture branch', dayLabel: '19 Oct', staffCurrent: null, serviceCurrent: null,
    branchId: 'branch-1', branchPromotions: [], isAuthed: true, step: 3,
};

describe.each(['ru', 'en', 'ky'] as const)('BookingSummary staff choice %s', locale => {
    const dictionary = { ru, en, ky }[locale];
    beforeEach(() => {
        (useLanguage as jest.Mock).mockReturnValue({
            locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key,
        });
    });

    it('represents the selected any-master mode as a complete choice', () => {
        render(<BookingSummary {...{ ...props, staffId: 'any' }} />);
        const value = screen.getByText(dictionary['booking.step3.anyMaster'], { exact: true });
        expect(value.parentElement?.previousElementSibling?.textContent).toBe('✓');
    });

    it('leaves an unselected staff choice incomplete', () => {
        render(<BookingSummary {...{ ...props, staffId: '' }} />);
        const label = screen.getByText(dictionary['booking.summary.master']);
        expect(label.parentElement?.textContent).toContain(dictionary['booking.summary.notSelected']);
        expect(label.parentElement?.previousElementSibling?.textContent).toBe('•');
    });

    it('preserves the concrete staff name and complete choice', () => {
        render(<BookingSummary {...{ ...props, staffId: 'staff-1', staffCurrent: {
            id: 'staff-1', full_name: 'Fixture Staff', branch_id: 'branch-1', rating_score: null,
        } }} />);
        const label = screen.getByText(dictionary['booking.summary.master']);
        expect(label.parentElement?.textContent).toContain('Fixture Staff');
        expect(label.parentElement?.previousElementSibling?.textContent).toBe('✓');
    });
});
