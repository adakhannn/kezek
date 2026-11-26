/**
 * Home discovery fixes: the category chips are the full public list with names (B3), cards show
 * the promotions badge (web promotions_count), open the business page (C2), and signed out the
 * home screen asks nothing account-specific (C1).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import HomeScreen from '../../screens/HomeScreen';
import { apiRequest } from '../../lib/api';
import { createTestQueryClient } from '../testQueryClient';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

jest.mock('../../hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOffline: false }),
}));

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

const mockTables: Record<string, unknown[]> = {
    categories: [
        { slug: 'hair', name_ru: 'Парикмахерская' },
        { slug: 'nails', name_ru: 'Маникюр' },
        { slug: 'spa', name_ru: 'СПА' },
    ],
    branches: [{ id: 'br-1', biz_id: 'biz-1' }],
    branch_promotions: [{ branch_id: 'br-1' }, { branch_id: 'br-1' }],
};

jest.mock('../../lib/supabase', () => {
    const table = (name: string) => {
        const result = () => Promise.resolve({ data: mockTables[name] ?? [], error: null });
        const builder: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'in', 'order']) builder[method] = () => builder;
        builder.then = (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => result().then(resolve, reject);
        return builder;
    };
    return {
        supabase: {
            auth: {
                // Nobody is signed in (C1).
                getUser: jest.fn(async () => ({
                    data: { user: null },
                    error: Object.assign(new Error('Auth session missing!'), { name: 'AuthSessionMissingError' }),
                })),
            },
            from: jest.fn((name: string) => table(name)),
        },
    };
});

const SALON = {
    id: 'biz-1',
    name: 'Test Salon',
    slug: 'test-salon',
    address: 'Some street',
    phones: null,
    categories: ['hair'],
    rating_score: 50,
};
const NAILS = { ...SALON, id: 'biz-2', name: 'Nail Studio', slug: 'nail-studio', categories: ['nails'] };

describe('home discovery', () => {
    const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

    const renderHome = () =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <HomeScreen />
            </QueryClientProvider>,
        );

    beforeEach(() => {
        mockNavigate.mockClear();
        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint === '/mobile/categories') return mockTables.categories;
            if (endpoint.startsWith('/mobile/businesses?category=hair')) return [SALON];
            if (endpoint.startsWith('/mobile/businesses')) return [SALON, NAILS];
            return [];
        });
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
    });

    test('category chips are the full named list and stay after one is picked (B3)', async () => {
        renderHome();

        expect(await screen.findByTestId('home-categories-nails')).toBeTruthy();
        expect(screen.getByTestId('home-categories-spa')).toBeTruthy();
        expect(screen.getByLabelText('Маникюр')).toBeTruthy();
        expect(screen.queryByLabelText('hair')).toBeNull();

        fireEvent.press(screen.getByTestId('home-categories-hair'));

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith('/mobile/businesses?category=hair&page=1&limit=20');
        });
        await waitFor(() => expect(screen.queryByText('Nail Studio')).toBeNull());

        // The other categories are still there to switch to.
        expect(screen.getByTestId('home-categories-nails')).toBeTruthy();
        expect(screen.getByTestId('home-categories-spa')).toBeTruthy();
        expect(screen.getByTestId('home-categories-hair').props.accessibilityState).toEqual(
            expect.objectContaining({ selected: true }),
        );
    });

    test('a card shows the promotions badge, the five-star rating and named categories', async () => {
        renderHome();

        expect(await screen.findByText('2 акции')).toBeTruthy();
        const card = screen.getByLabelText(/^Test Salon\./);
        expect(card.props.accessibilityLabel).toContain('Категории: Парикмахерская');
        expect(card.props.accessibilityLabel).toContain('Рейтинг: 2.5');
    });

    test('the card opens the business page, its button the booking flow, without an account', async () => {
        renderHome();

        fireEvent.press(await screen.findByLabelText(/^Test Salon\./));
        expect(mockNavigate).toHaveBeenCalledWith('Business', { slug: 'test-salon', previewName: 'Test Salon' });

        fireEvent.press(screen.getByLabelText('Записаться в Test Salon'));
        expect(mockNavigate).toHaveBeenCalledWith('Booking', { slug: 'test-salon', previewName: 'Test Salon' });

        // Signed out: no account request.
        expect(mockedApiRequest).not.toHaveBeenCalledWith('/mobile/bookings');
    });
});
