/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { commonEn } from '@/app/_components/i18n/dictionaries/common.en';
import { servicesEn } from '@/app/_components/i18n/dictionaries/services.en';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import ServicesListClient from '@/app/dashboard/services/ServicesListClient';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: jest.fn(),
}));

describe('ServicesListClient', () => {
    beforeEach(() => {
        const translations: Record<string, string> = { ...commonEn, ...servicesEn };
        (useLanguage as jest.Mock).mockReturnValue({
            locale: 'en',
            t: (key: string, fallback?: string) => translations[key] ?? fallback ?? key,
        });
    });

    it('uses compact cards below wide desktop and translates every service action', () => {
        const { container } = render(
            <ServicesListClient
                list={[{
                    name_ru: 'LIVE TEST Service 30',
                    name_ky: 'LIVE TEST Кызмат 30',
                    name_en: 'LIVE TEST Service 30 English',
                    duration_min: 30,
                    price_from: 300,
                    price_to: 350,
                    active: true,
                    branch_ids: ['branch-1'],
                    first_id: 'service-1',
                }]}
                branches={[{ id: 'branch-1', name: 'Branch 1' }]}
                branchFilter=""
                bizName="Test business"
            />
        );

        const compactView = container.querySelector('.grid.grid-cols-1');
        const table = container.querySelector('table');

        expect(compactView?.className).toContain('2xl:hidden');
        expect(table?.parentElement?.parentElement?.className).toContain('hidden 2xl:block');
        expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
        screen.getAllByRole('link', { name: 'Edit' }).forEach((link) => {
            expect(link.className).toContain('inline-flex');
            expect(link.className).toContain('items-center');
            expect(link.className).toContain('justify-center');
            expect(link.className).toContain('min-h-[36px]');
        });
        expect(screen.queryByText('Удалить')).toBeNull();
        expect(screen.getAllByText('30 min')).toHaveLength(2);
        expect(screen.getByText(/Business:\s*Test business/)).toBeTruthy();

        fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

        expect(screen.getByText('Delete service?')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    it.each([
        ['ru', 'LIVE TEST Service 30'],
        ['ky', 'LIVE TEST Кызмат 30'],
        ['en', 'LIVE TEST Service 30 English'],
    ] as const)('shows the service name for the selected %s locale', (locale, expectedName) => {
        const translations: Record<string, string> = { ...commonEn, ...servicesEn };
        (useLanguage as jest.Mock).mockReturnValue({
            locale,
            t: (key: string, fallback?: string) => translations[key] ?? fallback ?? key,
        });

        render(
            <ServicesListClient
                list={[{
                    name_ru: 'LIVE TEST Service 30',
                    name_ky: 'LIVE TEST Кызмат 30',
                    name_en: 'LIVE TEST Service 30 English',
                    duration_min: 30,
                    price_from: 300,
                    price_to: 350,
                    active: true,
                    branch_ids: ['branch-1'],
                    first_id: 'service-1',
                }]}
                branches={[{ id: 'branch-1', name: 'Branch 1' }]}
                branchFilter=""
            />
        );

        expect(screen.getAllByText(expectedName)).toHaveLength(2);
    });
});
