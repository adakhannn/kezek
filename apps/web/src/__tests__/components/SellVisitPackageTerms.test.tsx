/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { SellVisitPackageModal } from '@/app/dashboard/bookings/components/SellVisitPackageModal';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { dashboardRu } from '@/app/_components/i18n/dictionaries/dashboard.ru';
import { dashboardKy } from '@/app/_components/i18n/dictionaries/dashboard.ky';
import { dashboardEn } from '@/app/_components/i18n/dictionaries/dashboard.en';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
const fetchMock = jest.fn();
beforeEach(() => { jest.clearAllMocks(); global.fetch = fetchMock; });

test.each([
    ['ru', dashboardRu, 'Визиты', 'Срок (дней)', 'Скидка', 'Цена за визит'],
    ['ky', dashboardKy, 'Визиттер', 'Мөөнөтү (күн)', 'Арзандатуу', 'Бир визиттин баасы'],
    ['en', dashboardEn, 'Visits', 'Validity (days)', 'Discount', 'Price per visit'],
] as const)('localizes percent and fixed-price terms in %s, without offering inactive plans', async (locale, dictionary, visits, days, discount, price) => {
    jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) =>
        (dictionary as Record<string, string>)[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
    const percent = { id: 'plan-percent', name_ru: 'LIVE TEST', visit_count: 2, validity_days: 30,
        discount_type: 'percent', discount_value: 0, is_active: true };
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: { plans: [percent,
        { ...percent, id: 'fixed', name_ru: 'Fixed', discount_type: 'fixed_price', discount_value: 120.5 },
        { ...percent, id: 'inactive', name_ru: 'Inactive', is_active: false },
    ] } }) });
    render(<SellVisitPackageModal isOpen onClose={jest.fn()} clientId="client" clientName="LIVE TEST CLIENT" />);
    const terms = `${visits}: 2, ${days}: 30, ${discount}: 0%`;
    expect(await screen.findByRole('option', { name: `LIVE TEST — ${terms}`, exact: true })).toBeTruthy();
    expect(screen.getByText(`LIVE TEST: ${terms}`, { exact: true })).toBeTruthy();
    expect(screen.getByRole('option', { name: `Fixed — ${visits}: 2, ${days}: 30, ${price}: 120.5`, exact: true })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Inactive/ })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
});
