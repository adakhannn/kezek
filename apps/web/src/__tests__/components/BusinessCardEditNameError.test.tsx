/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { BusinessCardEdit } from '@/app/admin/businesses/[id]/BusinessCardEdit';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const initial = {
    name: 'TEST Business', slug: 'test-business', categories: ['barbershop'],
    address: null, phones: null, contact_phone: null, contact_whatsapp: null,
    contact_email: null, website_url: null, is_approved: true, created_at: null,
};
const props = { bizId: 'test-id', initial, categoryOptions: [{ slug: 'barbershop', name: 'Barbershop' }] };

describe.each([
    ['ru', ru, 'Введите название бизнеса'],
    ['ky', ky, 'Бизнестин аталышын киргизиңиз'],
    ['en', en, 'Enter the business name'],
] as const)('business name rejection %s', (locale, dictionary, message) => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(useLanguage).mockReturnValue({
            locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key,
        } as ReturnType<typeof useLanguage>);
    });

    it('localizes server rejection without changing payload; Cancel restores original', async () => {
        jest.mocked(global.fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, error: 'name cannot be empty' }) } as Response);
        render(<BusinessCardEdit {...props} />);
        fireEvent.click(screen.getByRole('button', { name: dictionary['admin.businessDetail.edit'], exact: true }));
        fireEvent.change(screen.getByRole('textbox', { name: dictionary['admin.businessDetail.name'], exact: true }), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: dictionary['admin.businessDetail.save'], exact: true }));
        expect(await screen.findByText(message, { exact: true })).toBeTruthy();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, request] = jest.mocked(global.fetch).mock.calls[0];
        expect(url).toBe('/admin/api/businesses/test-id/update');
        expect(request?.method).toBe('PATCH');
        expect(JSON.parse(String(request?.body))).toEqual({
            name: '', slug: 'business', categories: ['barbershop'], address: null, phones: null,
            contact_phone: '', contact_whatsapp: '', contact_email: '', website_url: '', is_approved: true,
        });
        expect(mockRefresh).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: dictionary['admin.businessDetail.cancel'], exact: true }));
        expect(screen.queryByText(message, { exact: true })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: dictionary['admin.businessDetail.edit'], exact: true }));
        expect((screen.getByRole('textbox', { name: dictionary['admin.businessDetail.name'], exact: true }) as HTMLInputElement).value).toBe(initial.name);
        expect((screen.getByRole('textbox', { name: dictionary['admin.businessDetail.slug'], exact: true }) as HTMLInputElement).value).toBe(initial.slug);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('preserves unrelated server feedback and retained editor', async () => {
        jest.mocked(global.fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'other unchanged error' }) } as Response);
        render(<BusinessCardEdit {...props} />);
        fireEvent.click(screen.getByRole('button', { name: dictionary['admin.businessDetail.edit'], exact: true }));
        fireEvent.click(screen.getByRole('button', { name: dictionary['admin.businessDetail.save'], exact: true }));
        expect(await screen.findByText('other unchanged error', { exact: true })).toBeTruthy();
        expect(screen.getByRole('button', { name: dictionary['admin.businessDetail.cancel'], exact: true })).toBeTruthy();
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('preserves successful save refresh and editor closure', async () => {
        jest.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) } as Response);
        render(<BusinessCardEdit {...props} />);
        fireEvent.click(screen.getByRole('button', { name: dictionary['admin.businessDetail.edit'], exact: true }));
        fireEvent.click(screen.getByRole('button', { name: dictionary['admin.businessDetail.save'], exact: true }));
        await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
        expect(screen.getByRole('button', { name: dictionary['admin.businessDetail.edit'], exact: true })).toBeTruthy();
    });
});
