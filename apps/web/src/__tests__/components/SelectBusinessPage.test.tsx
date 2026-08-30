/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import SelectBusinessPage from '@/app/select-business/page';

const replace = jest.fn();
const fetchMock = jest.fn();
const router = { replace };

jest.mock('next/navigation', () => ({
    useRouter: () => router,
}));

function businessResponse() {
    return {
        ok: true,
        json: async () => ({
            ok: true,
            data: {
                currentBizId: 'biz-1',
                businesses: [
                    { id: 'biz-1', name: 'First business', city: 'Bishkek', slug: 'first' },
                    { id: 'biz-2', name: 'Second business', city: null, slug: 'second' },
                ],
            },
        }),
    };
}

describe('SelectBusinessPage', () => {
    beforeEach(() => {
        replace.mockReset();
        fetchMock.mockReset();
        fetchMock.mockResolvedValue(businessResponse());
        global.fetch = fetchMock;
        window.localStorage.clear();
        document.cookie = 'kezek_lang=; max-age=0; path=/';
        document.cookie = 'kezek_locale=; max-age=0; path=/';
        document.cookie = 'kezek_lang=ru; path=/';
    });

    it('shows the current workspace and switches to another business', async () => {
        render(
            <LanguageProvider>
                <SelectBusinessPage />
            </LanguageProvider>,
        );

        await screen.findByText('Доступные бизнесы');
        expect(screen.getByText('Текущий')).toBeTruthy();
        expect(screen.getByText('/b/second')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /Second business/ }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
        expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ bizId: 'biz-2' });
    });

    it('uses the selected English locale for the whole screen', async () => {
        document.cookie = 'kezek_lang=en; path=/';
        window.localStorage.setItem('kezek_locale', 'en');

        render(
            <LanguageProvider>
                <SelectBusinessPage />
            </LanguageProvider>,
        );

        expect(await screen.findByText('Choose a business to work with')).toBeTruthy();
        expect(screen.getByText('Available businesses')).toBeTruthy();
        expect(screen.getByText('Current')).toBeTruthy();
    });

    it('uses the selected Kyrgyz locale for the whole screen', async () => {
        document.cookie = 'kezek_lang=ky; path=/';
        window.localStorage.setItem('kezek_locale', 'ky');

        render(
            <LanguageProvider>
                <SelectBusinessPage />
            </LanguageProvider>,
        );

        expect(await screen.findByText('Иштөө үчүн бизнести тандаңыз')).toBeTruthy();
        expect(screen.getByText('Жеткиликтүү бизнестер')).toBeTruthy();
        expect(screen.getByText('Учурдагы')).toBeTruthy();
    });
});
