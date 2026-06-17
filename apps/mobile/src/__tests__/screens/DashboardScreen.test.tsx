import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import DashboardScreen from '../../screens/DashboardScreen';
import { supabase } from '../../lib/supabase';
import { useDashboardScreenData } from '../../screens/dashboard/useDashboardScreenData';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../screens/dashboard/useDashboardScreenData', () => ({
    useDashboardScreenData: jest.fn(),
}));

const mockedUseDashboardScreenData = useDashboardScreenData as jest.MockedFunction<
    typeof useDashboardScreenData
>;

const baseState = {
    businesses: [],
    isOwner: false,
    isLoading: false,
    loadError: null,
    refreshing: false,
    onRefresh: jest.fn().mockResolvedValue(undefined),
};

describe('DashboardScreen', () => {
    const mockedSupabase = supabase as unknown as {
        auth: {
            getSession: jest.Mock;
        };
    };

    const renderWithQueryClient = (component: React.ReactElement) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                {component}
            </QueryClientProvider>,
        );

    beforeEach(() => {
        jest.clearAllMocks();
        mockedUseDashboardScreenData.mockReturnValue(baseState);
        mockedSupabase.auth.getSession.mockResolvedValue({
            data: {
                session: {
                    access_token: 'owner-access-token',
                    refresh_token: 'owner-refresh-token',
                },
            },
            error: null,
        });
    });

    test('renders loading state', () => {
        mockedUseDashboardScreenData.mockReturnValue({
            ...baseState,
            isLoading: true,
        });

        renderWithQueryClient(<DashboardScreen />);

        expect(screen.getByText('Загрузка...')).toBeTruthy();
    });

    test('renders non-owner empty state', () => {
        renderWithQueryClient(<DashboardScreen />);

        expect(screen.getByText('Вы не являетесь владельцем бизнеса')).toBeTruthy();
    });

    test('renders owner empty state', () => {
        mockedUseDashboardScreenData.mockReturnValue({
            ...baseState,
            isOwner: true,
        });

        renderWithQueryClient(<DashboardScreen />);

        expect(screen.getByText('Нет бизнесов')).toBeTruthy();
    });

    test('renders owner business widget', () => {
        mockedUseDashboardScreenData.mockReturnValue({
            ...baseState,
            isOwner: true,
            businesses: [
                {
                    id: 'business-1',
                    name: 'Low Fade',
                    slug: 'low-fade',
                    address: 'Ош',
                    phones: ['+996555000111'],
                },
            ],
        });

        renderWithQueryClient(<DashboardScreen />);

        expect(screen.getByText('Кабинет бизнеса')).toBeTruthy();
        expect(screen.getByText('Low Fade')).toBeTruthy();
        expect(screen.getByText('Открыть веб-кабинет')).toBeTruthy();
    });

    test('renders load error and retries', () => {
        const onRefresh = jest.fn().mockResolvedValue(undefined);
        mockedUseDashboardScreenData.mockReturnValue({
            ...baseState,
            loadError: new Error('network'),
            onRefresh,
        });

        renderWithQueryClient(<DashboardScreen />);
        fireEvent.press(screen.getByText('Повторить'));

        expect(screen.getByText('Не удалось загрузить кабинет бизнеса')).toBeTruthy();
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    test('opens the web dashboard from an owner widget', async () => {
        const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
        mockedUseDashboardScreenData.mockReturnValue({
            ...baseState,
            isOwner: true,
            businesses: [
                {
                    id: 'business-1',
                    name: 'Low Fade',
                    slug: 'low-fade',
                    address: null,
                    phones: null,
                },
            ],
        });

        renderWithQueryClient(<DashboardScreen />);
        fireEvent.press(screen.getByText('Открыть веб-кабинет'));

        await waitFor(() => {
            expect(openUrl).toHaveBeenCalledWith(
                'https://kezek.kg/auth/callback?next=%2Fselect-business' +
                    '#access_token=owner-access-token&refresh_token=owner-refresh-token',
            );
        });
    });
});
