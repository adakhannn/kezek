/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import BranchForm from '@/app/dashboard/branches/BranchForm';

const push = jest.fn();
const fetchMock = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
}));

jest.mock('@/components/admin/branches/BranchMapPickerYandex', () => ({
    __esModule: true,
    default: () => <div data-testid="map-picker" />,
}));

const initial = {
    name: '',
    address: '',
    is_active: true,
    contact_phone: '',
    contact_whatsapp: '',
    contact_email: '',
    website_url: '',
    inherit_business_contacts: true,
};

const businessContacts = {
    contact_phone: '+996555123456',
    contact_whatsapp: '+996700123456',
    contact_email: 'hello@business.kg',
    website_url: 'https://business.kg/',
};

describe('BranchForm inherited contacts', () => {
    beforeEach(() => {
        push.mockReset();
        fetchMock.mockReset();
        global.fetch = fetchMock;
        document.cookie = 'kezek_lang=ru; path=/';
        window.localStorage.setItem('kezek_locale', 'ru');
    });

    it('shows live business values while inheritance is enabled without copying them into the branch payload', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify({ ok: true }),
        });

        render(
            <LanguageProvider>
                <BranchForm initial={initial} businessContacts={businessContacts} apiBase="/api/branches" />
            </LanguageProvider>,
        );

        expect(screen.getByDisplayValue('+996555123456')).toBeTruthy();
        expect(screen.getByDisplayValue('hello@business.kg')).toBeTruthy();
        expect(screen.getAllByText(/Наследуется от бизнеса/)).toHaveLength(4);

        const inheritance = screen.getByRole('checkbox', { name: /Использовать контакты бизнеса/ });
        fireEvent.click(inheritance);
        expect(screen.queryByDisplayValue('+996555123456')).toBeNull();
        fireEvent.click(inheritance);

        fireEvent.change(screen.getByLabelText(/Название/), { target: { value: 'Central branch' } });
        fireEvent.submit(screen.getByRole('button', { name: /Сохранить/ }).closest('form')!);

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const request = fetchMock.mock.calls[0][1] as RequestInit;
        const payload = JSON.parse(String(request.body));
        expect(payload).toMatchObject({
            inherit_business_contacts: true,
            contact_phone: '',
            contact_whatsapp: '',
            contact_email: '',
            website_url: '',
        });
    });

    it('updates the complete contact section when English is selected', async () => {
        document.cookie = 'kezek_lang=en; path=/';
        window.localStorage.setItem('kezek_locale', 'en');

        const view = render(
            <LanguageProvider>
                <BranchForm initial={initial} businessContacts={businessContacts} apiBase="/api/branches" />
            </LanguageProvider>,
        );

        expect(await screen.findByText('Branch contacts')).toBeTruthy();
        expect(screen.getByRole('checkbox', { name: /Use business contacts/ })).toBeTruthy();
        expect(screen.getByLabelText('Branch phone')).toBeTruthy();
        expect(screen.getByLabelText('Branch WhatsApp')).toBeTruthy();
        expect(screen.getByLabelText('Branch email')).toBeTruthy();
        expect(screen.getByLabelText('Branch website')).toBeTruthy();
        expect(view.container.textContent).not.toContain('Контакты филиала');
        expect(view.container.textContent).not.toContain('Использовать контакты бизнеса');
    });
});
