/**
 * KEZEK-MOBILE-3: the cabinet's offline copy goes through the real offlineBookingsStorage and the
 * SecureStore mock, which rejects keys the native module rejects. A failing server (5xx) then shows
 * the saved bookings instead of an unhandled rejection.
 */
import React from 'react';
import * as SecureStore from 'expo-secure-store';
import { render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import CabinetScreen from '../../screens/CabinetScreen';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

describe('CabinetScreen offline copy', () => {
    const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
    const mockedAuth = supabase.auth as unknown as { getUser: jest.Mock };
    const store = new Map<string, string>();

    const renderCabinet = () =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <CabinetScreen />
            </QueryClientProvider>,
        );

    beforeEach(() => {
        store.clear();
        jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key: string) => store.get(key) ?? null);
        jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key: string, value: string) => {
            store.set(key, value);
        });
        jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key: string) => {
            store.delete(key);
        });
        mockedAuth.getUser.mockResolvedValue({
            data: { user: { id: 'cache-user', email: 'cache@example.com', phone: null } },
            error: null,
        });
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
        mockedAuth.getUser.mockReset();
        jest.mocked(SecureStore.getItemAsync).mockReset();
        jest.mocked(SecureStore.setItemAsync).mockReset();
        jest.mocked(SecureStore.deleteItemAsync).mockReset();
    });

    test('a 5xx after a successful load shows the saved bookings', async () => {
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: [
                {
                    id: 'booking-cached',
                    start_at: '2099-12-02T14:00:00Z',
                    end_at: '2099-12-02T14:30:00Z',
                    status: 'confirmed',
                    service: { name_ru: 'Cached Cut' },
                    staff: { full_name: 'Cached Master' },
                    branch: { name: 'Cached Branch' },
                    business: { name: 'Cached Business', tz: 'Asia/Bishkek' },
                },
            ],
        } as never);

        const first = renderCabinet();
        expect((await screen.findAllByText('Cached Cut', {}, { timeout: 5000 })).length).toBeGreaterThan(0);
        expect([...store.keys()].some((key) => key.startsWith('kezek.offline.bookings.cache-user'))).toBe(true);
        first.unmount();

        mockedApiRequest.mockRejectedValue(Object.assign(new Error('Service unavailable'), { status: 503 }));

        renderCabinet();
        expect(await screen.findByText('Показываем сохранённые записи', {}, { timeout: 5000 })).toBeTruthy();
        expect((await screen.findAllByText('Cached Cut')).length).toBeGreaterThan(0);
    });
});
