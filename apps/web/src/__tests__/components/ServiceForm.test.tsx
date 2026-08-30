/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ServiceForm from '@/app/dashboard/services/ServiceForm';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ t: String }),
}));

describe('ServiceForm duration', () => {
    beforeEach(() => {
        mockPush.mockReset();
        global.fetch = jest.fn();
    });

    function renderForm() {
        render(
            <ServiceForm
                initial={{
                    name_ru: 'Test service',
                    name_ky: null,
                    name_en: null,
                    duration_min: 60,
                    price_from: 0,
                    price_to: 0,
                    active: true,
                    branch_id: '',
                    branch_ids: ['branch-1'],
                }}
                branches={[{ id: 'branch-1', name: 'Main branch' }]}
                apiBase="/api/services"
            />,
        );

        return screen.getByLabelText('services.form.duration') as HTMLInputElement;
    }

    it('keeps the field empty while editing instead of forcing zero', () => {
        const duration = renderForm();

        fireEvent.change(duration, { target: { value: '' } });

        expect(duration.value).toBe('');
    });

    it('normalizes a leading-zero duration to the intended number', () => {
        const duration = renderForm();

        fireEvent.change(duration, { target: { value: '' } });
        fireEvent.change(duration, { target: { value: '030' } });

        expect(duration.value).toBe('30');
        expect(duration.valueAsNumber).toBe(30);
    });

    it('submits the normalized duration as a number', async () => {
        const duration = renderForm();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true }),
        });

        fireEvent.change(duration, { target: { value: '030' } });
        fireEvent.submit(duration.closest('form')!);

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
        const [, request] = (global.fetch as jest.Mock).mock.calls[0];
        expect(JSON.parse(request.body)).toMatchObject({ duration_min: 30 });
        expect(mockPush).toHaveBeenCalledWith('/dashboard/services');
    });
});
