import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import ProfileScreen from '../../screens/ProfileScreen';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { createTestQueryClient } from '../testQueryClient';

const mockShowToast = jest.fn();

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

jest.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}));

describe('ProfileScreen', () => {
    const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
    const mockedSupabase = supabase as unknown as {
        auth: {
            getUser: jest.Mock;
        };
        from: jest.Mock;
    };

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
    };

    beforeEach(() => {
        mockShowToast.mockReset();
        mockedApiRequest.mockResolvedValue({ ok: true } as never);

        mockedSupabase.auth.getUser.mockResolvedValue({
            data: {
                user: {
                    id: 'test-user-id',
                    email: 'test@example.com',
                    phone: null,
                },
            },
            error: null,
        });

        mockedSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: {
                    id: 'test-user-id',
                    full_name: 'Test User',
                    phone: '+996555000111',
                    notify_email: true,
                    notify_whatsapp: true,
                },
                error: null,
            }),
        });
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
        mockedSupabase.auth.getUser.mockReset();
        mockedSupabase.from.mockReset();
    });

    test('renders profile screen root', async () => {
        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByTestId('profile-screen')).toBeTruthy();
    });

    test('renders profile data and localized labels', async () => {
        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByText('Профиль')).toBeTruthy();
        expect(await screen.findByDisplayValue('Test User')).toBeTruthy();
        expect(await screen.findByDisplayValue('+996555000111')).toBeTruthy();
        expect(await screen.findByText('Email нельзя изменить')).toBeTruthy();
    });

    test('saves profile updates with trimmed values', async () => {
        renderWithProviders(<ProfileScreen />);

        fireEvent.changeText(await screen.findByDisplayValue('Test User'), '  Updated User  ');
        fireEvent.changeText(await screen.findByDisplayValue('+996555000111'), ' +996555222333 ');
        fireEvent.press(await screen.findByText('Сохранить'));

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith('/profile/update', {
                method: 'POST',
                body: JSON.stringify({
                    full_name: 'Updated User',
                    phone: '+996555222333',
                    notify_email: true,
                    notify_whatsapp: true,
                }),
            });
        });
    });

    test('blocks save when full name is empty', async () => {
        renderWithProviders(<ProfileScreen />);

        fireEvent.changeText(await screen.findByDisplayValue('Test User'), '   ');
        fireEvent.press(await screen.findByText('Сохранить'));

        expect(mockedApiRequest).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('Введите имя', 'error');
    });

    test('blocks save when phone format is invalid', async () => {
        renderWithProviders(<ProfileScreen />);

        fireEvent.changeText(await screen.findByDisplayValue('+996555000111'), 'bad-phone');
        fireEvent.press(await screen.findByText('Сохранить'));

        expect(mockedApiRequest).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('Введите корректный номер телефона', 'error');
    });

    test('shows server error toast when profile update fails', async () => {
        mockedApiRequest.mockRejectedValueOnce(new Error('Server validation failed'));

        renderWithProviders(<ProfileScreen />);
        fireEvent.press(await screen.findByText('Сохранить'));

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith('Server validation failed', 'error');
        });
    });

    test('renders load error state', async () => {
        mockedSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('profile unavailable'),
            }),
        });

        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByText('Не удалось загрузить профиль')).toBeTruthy();
        expect(await screen.findByText('Повторить')).toBeTruthy();
    });
});
