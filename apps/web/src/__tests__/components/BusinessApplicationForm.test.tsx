/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { BusinessApplicationForm } from '@/app/business/apply/BusinessApplicationForm';

const fetchMock = jest.fn();

describe('BusinessApplicationForm categories', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true }),
        });
        global.fetch = fetchMock;
    });

    it('prefills account contacts and defaults the city to Osh', () => {
        render(
            <BusinessApplicationForm
                categories={[]}
                initialValues={{
                    contact_name: 'Аккаунт владельца',
                    phone: '+996770574029',
                    email: 'owner@example.com',
                }}
            />,
        );

        expect((screen.getByLabelText('Ваше имя') as HTMLInputElement).value).toBe('Аккаунт владельца');
        expect((screen.getByLabelText('Телефон') as HTMLInputElement).value).toBe('+996770574029');
        expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('owner@example.com');
        expect((screen.getByLabelText('Город') as HTMLInputElement).value).toBe('Ош');
        expect((screen.getByLabelText('Email') as HTMLInputElement).required).toBe(true);
        expect((screen.getByLabelText('Город') as HTMLInputElement).required).toBe(true);
    });

    it('submits the slug of an existing system category', async () => {
        const { container } = render(
            <BusinessApplicationForm categories={[{ slug: 'barbershop', name: 'Барбершоп' }]} />,
        );

        fireEvent.change(screen.getByLabelText('Категория бизнеса'), { target: { value: 'barbershop' } });
        fireEvent.submit(container.querySelector('form')!);

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const request = fetchMock.mock.calls[0][1] as RequestInit;
        expect(JSON.parse(String(request.body))).toMatchObject({ category: 'barbershop' });
    });

    it('allows the applicant to propose a missing category', async () => {
        const { container } = render(
            <BusinessApplicationForm categories={[{ slug: 'barbershop', name: 'Барбершоп' }]} />,
        );

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
});
