/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import { BusinessApplicationForm } from '@/app/business/apply/BusinessApplicationForm';

const fetchMock = jest.fn();

function renderForm(props: React.ComponentProps<typeof BusinessApplicationForm>) {
    return render(
        <LanguageProvider>
            <BusinessApplicationForm {...props} />
        </LanguageProvider>,
    );
}

describe('BusinessApplicationForm categories', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true }),
        });
        global.fetch = fetchMock;
        window.localStorage.clear();
        document.cookie = 'kezek_lang=ru; path=/';
    });

    it('prefills account contacts without asking for a fixed city', () => {
        renderForm({
            categories: [],
            initialValues: {
                contact_name: 'Аккаунт владельца',
                phone: '+996770574029',
                email: 'owner@example.com',
            },
        });

        expect((screen.getByLabelText('Ваше имя') as HTMLInputElement).value).toBe('Аккаунт владельца');
        expect((screen.getByLabelText('Телефон') as HTMLInputElement).value).toBe('+996770574029');
        expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('owner@example.com');
        expect((screen.getByLabelText('Email') as HTMLInputElement).required).toBe(true);
        expect(screen.queryByLabelText('Город')).toBeNull();
    });

    it('submits the slug of an existing system category', async () => {
        const { container } = renderForm({
            categories: [{ slug: 'barbershop', name: 'Барбершоп' }],
        });

        fireEvent.change(screen.getByLabelText('Категория бизнеса'), { target: { value: 'barbershop' } });
        fireEvent.submit(container.querySelector('form')!);

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const request = fetchMock.mock.calls[0][1] as RequestInit;
        const body = JSON.parse(String(request.body));
        expect(body).toMatchObject({ category: 'barbershop' });
        expect(body).not.toHaveProperty('city');
    });

    it('allows the applicant to propose a missing category', async () => {
        const { container } = renderForm({
            categories: [{ slug: 'barbershop', name: 'Барбершоп' }],
        });

        fireEvent.change(screen.getByLabelText('Категория бизнеса'), {
            target: { value: '__propose_category__' },
        });
        fireEvent.change(screen.getByLabelText('Предложите новую категорию'), {
            target: { value: 'Груминг-салон' },
        });
        fireEvent.submit(container.querySelector('form')!);

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const request = fetchMock.mock.calls[0][1] as RequestInit;
        expect(JSON.parse(String(request.body))).toMatchObject({ category: 'Груминг-салон' });
    });

    it('explains how to proceed when the business already exists', async () => {
        window.localStorage.setItem('kezek_lang', 'en');
        document.cookie = 'kezek_lang=en; path=/';
        fetchMock.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ ok: false, code: 'business_exists' }),
        });
        const { container } = renderForm({
            categories: [{ slug: 'barbershop', name: 'Barbershop' }],
        });

        fireEvent.change(screen.getByLabelText('Business category'), {
            target: { value: 'barbershop' },
        });
        fireEvent.submit(container.querySelector('form')!);

        await waitFor(() => {
            expect(screen.getByText(
                'A business with this name already exists in Kezek. Request owner access instead of creating a duplicate listing.',
            )).toBeTruthy();
        });
    });
});
