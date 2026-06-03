import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import StaffScreen from '../../screens/StaffScreen';
import { supabase } from '../../lib/supabase';
import { createTestQueryClient } from '../testQueryClient';

const mockNavigate = jest.fn();

const TEXT = {
    nonStaffTitle: '\u0412\u044b \u043d\u0435 \u044f\u0432\u043b\u044f\u0435\u0442\u0435\u0441\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u043e\u043c',
    nonStaffMessage: '\u0417\u0434\u0435\u0441\u044c \u0431\u0443\u0434\u0443\u0442 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0442\u044c\u0441\u044f \u0432\u0430\u0448\u0438 \u0437\u0430\u043f\u0438\u0441\u0438 \u043f\u043e\u0441\u043b\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u043e\u043c',
    dashboardTitle: '\u041a\u0430\u0431\u0438\u043d\u0435\u0442 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430',
    branchName: 'Low Fade \u042e\u0433\u043e-\u0412\u043e\u0441\u0442\u043e\u043a',
    upcomingTitle: '\u041f\u0440\u0435\u0434\u0441\u0442\u043e\u044f\u0449\u0438\u0435 \u0437\u0430\u043f\u0438\u0441\u0438',
    serviceName: '\u0412\u0437\u0440\u043e\u0441\u043b\u0430\u044f \u0441\u0442\u0440\u0438\u0436\u043a\u0430',
    shiftAction: '\u041c\u043e\u044f \u0441\u043c\u0435\u043d\u0430',
    statsAction: '\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430',
    loadErrorTitle: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0440\u0430\u0431\u043e\u0447\u0443\u044e \u0437\u043e\u043d\u0443',
    retry: '\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c',
};

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
}));

jest.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id' },
    }),
}));

describe('StaffScreen', () => {
    const mockedSupabase = supabase as unknown as {
        from: jest.Mock;
    };

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
    };

    const mockStaffQuery = (data: unknown, error: Error | null = null) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data, error }),
    });

    const mockBookingsQuery = (data: unknown[], error: Error | null = null) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data, error }),
    });

    beforeEach(() => {
        mockNavigate.mockReset();
        mockedSupabase.from.mockReset();
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === 'staff') {
                return mockStaffQuery(null);
            }

            return mockBookingsQuery([]);
        });
    });

    test('renders empty staff state after loading', async () => {
        renderWithProviders(<StaffScreen />);

        expect(await screen.findByText(TEXT.nonStaffTitle)).toBeTruthy();
        expect(await screen.findByText(TEXT.nonStaffMessage)).toBeTruthy();
    });

    test('renders staff dashboard with availability and upcoming booking', async () => {
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === 'staff') {
                return mockStaffQuery({
                    id: 'staff-1',
                    full_name: 'Adakhan',
                    branch: { id: 'branch-1', name: TEXT.branchName },
                    business: { id: 'biz-1', name: 'Low Fade' },
                });
            }

            return mockBookingsQuery([
                {
                    id: 'booking-1',
                    start_at: '2026-06-03T10:00:00.000Z',
                    end_at: '2026-06-03T10:30:00.000Z',
                    client_name: 'Client One',
                    client_phone: '+996555111222',
                    service: { name_ru: TEXT.serviceName },
                },
            ]);
        });

        renderWithProviders(<StaffScreen />);

        expect(await screen.findByTestId('staff-screen')).toBeTruthy();
        expect(await screen.findByText(TEXT.dashboardTitle)).toBeTruthy();
        expect(await screen.findByText('Adakhan')).toBeTruthy();
        expect(await screen.findByText(TEXT.branchName)).toBeTruthy();
        expect(await screen.findByText('Low Fade')).toBeTruthy();
        expect(await screen.findByText(TEXT.upcomingTitle)).toBeTruthy();
        expect(await screen.findByText(TEXT.serviceName)).toBeTruthy();
        expect(await screen.findByText('Клиент: Client One')).toBeTruthy();
        expect(await screen.findByText('+996555111222')).toBeTruthy();
    });

    test('navigates to key staff actions', async () => {
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === 'staff') {
                return mockStaffQuery({
                    id: 'staff-1',
                    full_name: 'Adakhan',
                    branch: null,
                    business: null,
                });
            }

            return mockBookingsQuery([]);
        });

        renderWithProviders(<StaffScreen />);

        fireEvent.press(await screen.findByText(TEXT.shiftAction));
        expect(mockNavigate).toHaveBeenCalledWith('ShiftQuick');

        fireEvent.press(await screen.findByText(TEXT.statsAction));
        expect(mockNavigate).toHaveBeenCalledWith('Shifts');
    });

    test('renders explicit load error instead of non-staff state', async () => {
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === 'staff') {
                return mockStaffQuery(null, new Error('staff query failed'));
            }

            return mockBookingsQuery([]);
        });

        renderWithProviders(<StaffScreen />);

        expect(await screen.findByText(TEXT.loadErrorTitle)).toBeTruthy();
        expect(await screen.findByText(TEXT.retry)).toBeTruthy();
        expect(screen.queryByText(TEXT.nonStaffTitle)).toBeNull();
    });
});