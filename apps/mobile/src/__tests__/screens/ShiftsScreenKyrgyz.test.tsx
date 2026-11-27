/**
 * Shift statistics in Kyrgyz: texts, the Kyrgyz date (no Intl 'ky-KG') and money in сом.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

import { LanguageProvider } from '../../i18n';
import { setRequestLocale } from '../../i18n/locale';
import { LOCALE_STORAGE_KEY } from '../../i18n/localeStorage';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import ShiftsScreen from '../../screens/ShiftsScreen';
import { staffCard, staffCardsQuery } from '../staffCards';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: jest.fn() }),
}));

const stats = {
    period: 'day',
    dateFrom: '2026-06-06',
    dateTo: '2026-06-06',
    staffName: 'Test Staff',
    shiftsCount: 1,
    openShiftsCount: 0,
    closedShiftsCount: 1,
    totalAmount: 800,
    totalMaster: 480,
    totalSalon: 440,
    totalConsumables: 120,
    totalLateMinutes: 5,
    totalClients: 1,
    totalBaseMasterShare: 480,
    totalBaseSalonShare: 440,
    shifts: [
        {
            id: 'shift-1',
            shift_date: '2026-06-06',
            status: 'closed',
            opened_at: '2026-06-06T11:00:00.000Z',
            closed_at: '2026-06-06T12:00:00.000Z',
            total_amount: 800,
            consumables_amount: 120,
            base_master_share: 480,
            base_salon_share: 440,
            master_share: 480,
            salon_share: 440,
            late_minutes: 5,
            hours_worked: 1,
            hourly_rate: null,
            guaranteed_amount: 0,
            items: [
                {
                    id: 'item-1',
                    client_name: '',
                    service_name: 'Haircut',
                    service_amount: 800,
                    consumables_amount: 120,
                    note: null,
                    booking_id: null,
                    created_at: '2026-06-06T11:30:00.000Z',
                },
            ],
        },
    ],
};

describe('ShiftsScreen in Kyrgyz', () => {
    beforeEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
            key === LOCALE_STORAGE_KEY ? 'ky' : null,
        );
        (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
        (supabase as unknown as { from: jest.Mock }).from.mockReturnValue(
            staffCardsQuery([staffCard({ id: 'staff-1', full_name: 'Test Staff' })]),
        );
        (apiRequest as jest.Mock).mockResolvedValue({ ok: true, data: { stats } });
    });

    afterEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockReset();
        (apiRequest as jest.Mock).mockReset();
        setRequestLocale('ru');
    });

    test('statistics, the shift card and its clients speak Kyrgyz', async () => {
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <LanguageProvider>
                    <ShiftsScreen />
                </LanguageProvider>
            </QueryClientProvider>,
        );

        // The header carries the title: the screen itself starts with the master and the numbers.
        expect(await screen.findByText('Айлануу', {}, { timeout: 5000 })).toBeTruthy();
        expect(screen.queryByText('Сменалар жана статистика')).toBeNull();
        expect(screen.getByText('Ай')).toBeTruthy();
        expect(screen.getByText('Айлануу')).toBeTruthy();
        expect(screen.getByText('Кызматкердин үлүшү')).toBeTruthy();
        expect(screen.getByText('кирешенин 60%')).toBeTruthy();
        expect(screen.getByText('5 мин')).toBeTruthy();
        expect(screen.getAllByText('800 сом')).toHaveLength(2);
        expect(screen.getByText('1 кардар')).toBeTruthy();
        expect(screen.getByText('Жабык')).toBeTruthy();
        expect(screen.getByText('Кызматкерге: 480 сом')).toBeTruthy();
        expect(screen.queryByText('Смены и статистика')).toBeNull();

        fireEvent.press(screen.getByText('2026-ж., 6-июнь'));

        expect(await screen.findByText('Кардарлардын тизмеси')).toBeTruthy();
        expect(screen.getByText('Кардар көрсөтүлгөн эмес')).toBeTruthy();
        expect(screen.getAllByText('Чыгымдар: 120 сом')).toHaveLength(2);
    });
});
