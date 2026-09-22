/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { Footer } from '@/app/_components/Footer';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: jest.fn(),
}));

describe('Footer', () => {
    it('uses translations for the business links', () => {
        (useLanguage as jest.Mock).mockReturnValue({
            t: (key: string, fallback?: string) => {
                const translations: Record<string, string> = {
                    'footer.connectBusiness': 'Бизнести кошуу',
                    'footer.joinBusiness': 'Бизнеске кошулуу',
                };
                return translations[key] ?? fallback ?? key;
            },
        });

        render(<Footer />);

        expect(screen.getByRole('link', { name: 'Бизнести кошуу' }).getAttribute('href'))
            .toBe('/business/apply');
        expect(screen.getByRole('link', { name: 'Бизнеске кошулуу' }).getAttribute('href'))
            .toBe('/business/role-apply');
    });
});
