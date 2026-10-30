/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ServiceForm from '@/app/dashboard/services/ServiceForm';
import { servicesEn } from '@/app/_components/i18n/dictionaries/services.en';
import { servicesKy } from '@/app/_components/i18n/dictionaries/services.ky';
import { servicesRu } from '@/app/_components/i18n/dictionaries/services.ru';

const mockPush = jest.fn();
let mockDictionary: Record<string, string> = {};
let mockUseFallback = false;

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({
        t: (key: string, fallback?: string) => mockDictionary[key] ?? (mockUseFallback ? fallback ?? key : key),
    }),
}));

describe('ServiceForm duration', () => {
    beforeEach(() => {
        mockPush.mockReset();
        mockDictionary = {};
        mockUseFallback = false;
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

describe('ServiceForm localized name length feedback', () => {
    beforeEach(() => {
        mockPush.mockReset();
        global.fetch = jest.fn();
    });

    const locales = [
        { locale: 'ru', dictionary: servicesRu, message: 'Введите от 2 до 100 символов' },
        { locale: 'ky', dictionary: servicesKy, message: '2ден 100гө чейин белги жазыңыз' },
        { locale: 'en', dictionary: servicesEn, message: 'Enter between 2 and 100 characters' },
        { locale: 'fallback', dictionary: {}, message: 'Введите от 2 до 100 символов' },
    ];

    for (const { locale, dictionary, message } of locales) {
        for (const field of ['nameRu', 'nameKy', 'nameEn']) {
            it.each([1, 101])(`${locale}/${field}: explains both length limits for %i characters without sending`, (length) => {
                mockDictionary = dictionary;
                mockUseFallback = locale === 'fallback';
                render(
                    <ServiceForm
                        initial={{ id: 'existing-service', name_ru: 'Original service', name_ky: 'Кыргызча кызмат', name_en: 'English service', duration_min: 1, price_from: 0, price_to: 300, active: true, branch_id: 'branch-1', branch_ids: ['branch-1'] }}
                        branches={[{ id: 'branch-1', name: 'Main branch' }]}
                        apiBase="/api/services"
                    />,
                );
                const labelKey = `services.form.${field}`;
                const fallbackLabels: Record<string, string> = { nameRu: 'Название (русский) *', nameKy: 'Название (кыргызский)', nameEn: 'Название (английский)' };
                const input = screen.getByLabelText(mockDictionary[labelKey] ?? fallbackLabels[field]) as HTMLInputElement;
                const draft = 'X'.repeat(length);
                fireEvent.change(input, { target: { value: draft } });
                fireEvent.submit(input.closest('form')!);

                expect(screen.getByText(message, { exact: true })).toBeTruthy();
                expect(screen.getByText(mockDictionary['services.form.error.fixFields'] ?? 'Проверьте выделенные поля', { exact: true })).toBeTruthy();
                expect(input.value).toBe(draft);
                expect(global.fetch).not.toHaveBeenCalled();
                expect(mockPush).not.toHaveBeenCalled();
            });
        }
    }
});
