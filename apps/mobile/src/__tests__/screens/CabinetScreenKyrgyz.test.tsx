/**
 * The client cabinet in Kyrgyz: texts come from cabinet.ky.ts and dates from the Intl-free
 * Kyrgyz formatter (i18n/kyDate.ts).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

import { LanguageProvider } from '../../i18n';
import { setRequestLocale } from '../../i18n/locale';
import { LOCALE_STORAGE_KEY } from '../../i18n/localeStorage';
import { apiRequest } from '../../lib/api';
import { signOutConfirmationText } from '../../lib/signOut';
import { supabase } from '../../lib/supabase';
import { createTranslate } from '../../i18n/translate';
import CabinetScreen from '../../screens/CabinetScreen';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

jest.mock('../../lib/offlineBookingsStorage', () => ({
    loadOfflineBookings: jest.fn(async () => null),
    saveOfflineBookings: jest.fn(async () => undefined),
}));

describe('CabinetScreen in Kyrgyz', () => {
    const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
    const mockedGetUser = (supabase as unknown as { auth: { getUser: jest.Mock } }).auth.getUser;

    beforeEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
            key === LOCALE_STORAGE_KEY ? 'ky' : null,
        );
        (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
        mockedGetUser.mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'test@example.com', phone: null } },
            error: null,
        });
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
        mockedGetUser.mockReset();
        (SecureStore.getItemAsync as jest.Mock).mockReset();
        setRequestLocale('ru');
    });

    test('renders the cabinet and a booking card in Kyrgyz', async () => {
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: [
                {
                    id: 'booking-1',
                    start_at: '2099-12-02T14:00:00Z',
                    end_at: '2099-12-02T14:30:00Z',
                    status: 'confirmed',
                    service: { name_ru: 'Adult Cut' },
                    staff: null,
                    branch: null,
                    business: { name: 'Low Fade' },
                },
            ],
        } as never);

        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <LanguageProvider>
                    <CabinetScreen />
                </LanguageProvider>
            </QueryClientProvider>,
        );

        // The header carries the title; the screen opens with the person and the next visit.
        expect(await screen.findByText('Менин жазылыштарым', {}, { timeout: 5000 })).toBeTruthy();
        expect(screen.getByText('Кийинки визит')).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Алдыдагы жазылуулар' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Жазылуулардын таржымалы' })).toBeTruthy();
        expect(screen.getByText('Мастер такталууда')).toBeTruthy();
        expect(screen.getByText('Аккаунттан чыгуу')).toBeTruthy();
        // 14:00 UTC is 20:00 in Bishkek; the month is Kyrgyz, not Intl's.
        expect(screen.getByText('2099-ж., 2-декабрь, саат 20:00')).toBeTruthy();
        expect(screen.getByText('2099-ж., 2-декабрь • 20:00–20:30')).toBeTruthy();
        expect(screen.queryByText('Кабинет клиента')).toBeNull();
    });

    test('the sign-out confirmation follows the language', () => {
        const ky = signOutConfirmationText(3, createTranslate('ky'));
        expect(ky.title).toBe('Жөнөтүлө элек смена өзгөртүүлөрү бар');
        expect(ky.message).toContain('3 смена өзгөртүүсү серверге али жөнөтүлө элек.');
        expect(ky.confirmLabel).toBe('Чыгуу жана өчүрүү');

        expect(signOutConfirmationText(1, createTranslate('en')).message).toContain('1 shift change has not been sent');
        expect(signOutConfirmationText(5, createTranslate('en')).message).toContain('5 shift changes have not been sent');
    });
});
