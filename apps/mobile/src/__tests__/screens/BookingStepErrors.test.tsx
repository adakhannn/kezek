/**
 * B4: a failed load in booking steps 1-3 is an error with a retry, never "not found" or an empty list.
 */
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useBusinessWithBranches } from '../../hooks/useBusinessWithBranches';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import BookingStep1Branch from '../../screens/booking/BookingStep1Branch';
import BookingStep2Service from '../../screens/booking/BookingStep2Service';
import BookingStep3Staff from '../../screens/booking/BookingStep3Staff';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
    useRoute: () => ({ params: { slug: 'test-business-slug' } }),
}));
jest.mock('../../lib/analytics', () => ({ trackMobileEvent: jest.fn() }));
jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../../hooks/useBusinessWithBranches', () => ({
    ...jest.requireActual('../../hooks/useBusinessWithBranches'),
    useBusinessWithBranches: jest.fn(),
}));

const mockBusiness = jest.mocked(useBusinessWithBranches);
const mockApiRequest = jest.mocked(apiRequest);

function renderStep(component: React.ReactElement) {
    return render(<QueryClientProvider client={createTestQueryClient()}>{component}</QueryClientProvider>);
}

/** A supabase query chain that answers `result` whatever filters are applied. */
function chain(result: unknown) {
    const query: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'in', 'order', 'gte', 'lt']) query[name] = jest.fn(() => query);
    query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
    return query;
}

const networkFailure = { data: null, error: { message: 'Network request failed' } };

afterEach(() => {
    jest.mocked(supabase.from).mockReset();
    mockApiRequest.mockReset();
});

describe('step 1: business', () => {
    test('a network failure offers a retry instead of "Business not found"', () => {
        const refetch = jest.fn();
        mockBusiness.mockReturnValue({
            data: undefined,
            error: new Error('Network request failed'),
            isLoading: false,
            isFetching: false,
            refetch,
        } as never);

        renderStep(<BookingStep1Branch />);

        expect(screen.getByText('Не удалось загрузить бизнес')).toBeTruthy();
        expect(screen.queryByText('Бизнес не найден')).toBeNull();
        fireEvent.press(screen.getByText('Повторить'));
        expect(refetch).toHaveBeenCalled();
    });

    test('a business that does not exist is still "not found"', () => {
        mockBusiness.mockReturnValue({
            data: undefined,
            error: Object.assign(new Error('Бизнес не найден'), { code: 'BUSINESS_NOT_FOUND' }),
            isLoading: false,
            isFetching: false,
            refetch: jest.fn(),
        } as never);

        renderStep(<BookingStep1Branch />);

        expect(screen.getByText('Бизнес не найден')).toBeTruthy();
        expect(screen.queryByText('Повторить')).toBeNull();
    });
});

describe('steps 2 and 3', () => {
    test('services that failed to load are not "no services"', async () => {
        jest.mocked(supabase.from).mockImplementation(() => chain(networkFailure) as never);

        renderStep(<BookingStep2Service />);

        expect(await screen.findByText('Не удалось загрузить услуги')).toBeTruthy();
        expect(screen.queryByText('Нет доступных услуг')).toBeNull();
        expect(screen.getByText('Повторить')).toBeTruthy();
    });

    test('masters that failed to load are not "no masters", and retry loads them', async () => {
        jest.mocked(supabase.from).mockImplementation(() => chain(networkFailure) as never);
        mockApiRequest.mockResolvedValue({ ok: true, data: [] });

        renderStep(<BookingStep3Staff />);

        expect(await screen.findByText('Не удалось загрузить мастеров')).toBeTruthy();
        expect(screen.queryByText('Нет доступных мастеров')).toBeNull();

        jest.mocked(supabase.from).mockImplementation(((table: string) =>
            chain(
                table === 'staff'
                    ? {
                          data: [{ id: 'staff-2', full_name: 'Айгерим', branch_id: 'branch-1', rating_score: null, avatar_url: null }],
                          error: null,
                      }
                    : { data: [], error: null },
            )) as never);
        fireEvent.press(screen.getByText('Повторить'));

        expect(await screen.findByText('Айгерим')).toBeTruthy();
        expect(screen.getByText('Любой мастер')).toBeTruthy();
    });

    test('a failed work-location request is an error too', async () => {
        jest.mocked(supabase.from).mockImplementation(() => chain({ data: [], error: null }) as never);
        mockApiRequest.mockRejectedValue(new Error('Network request failed'));

        renderStep(<BookingStep3Staff />);

        expect(await screen.findByText('Не удалось загрузить мастеров')).toBeTruthy();
    });
});
