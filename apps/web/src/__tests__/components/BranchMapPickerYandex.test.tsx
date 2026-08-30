/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import BranchMapPickerYandex from '@/components/admin/branches/BranchMapPickerYandex';
import { logWarn } from '@/lib/log';
import { loadYandexMaps } from '@/lib/yamaps';

jest.mock('@/lib/yamaps', () => ({
    loadYandexMaps: jest.fn().mockRejectedValue(new Error('controlled map failure')),
}));

jest.mock('@/lib/log', () => ({
    logWarn: jest.fn(),
}));

describe('BranchMapPickerYandex localization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (loadYandexMaps as jest.Mock).mockRejectedValue(new Error('controlled map failure'));
        document.cookie = 'kezek_lang=en; path=/';
        window.localStorage.setItem('kezek_locale', 'en');
    });

    it('localizes map guidance and its recoverable error state', async () => {
        render(
            <LanguageProvider>
                <BranchMapPickerYandex onPick={jest.fn()} />
            </LanguageProvider>,
        );

        expect(await screen.findByText('Could not load the map')).toBeTruthy();
        expect(screen.getByText('The map is temporarily unavailable. Enter the branch address manually.')).toBeTruthy();
        expect(screen.getByText('Move the marker or select an address using map search.')).toBeTruthy();
        expect(screen.getByText('Yandex Maps')).toBeTruthy();
        expect(logWarn).toHaveBeenCalledWith(
            'BranchMapPicker',
            'Yandex Maps is temporarily unavailable',
            expect.any(Error),
        );

        const callsBeforeRetry = (loadYandexMaps as jest.Mock).mock.calls.length;
        fireEvent.click(screen.getByRole('button', { name: 'Retry map loading' }));
        await waitFor(() => expect(loadYandexMaps).toHaveBeenCalledTimes(callsBeforeRetry + 1));
    });
});
