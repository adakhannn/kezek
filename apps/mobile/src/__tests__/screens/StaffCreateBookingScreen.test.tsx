import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import StaffCreateBookingScreen from '../../screens/StaffCreateBookingScreen';
import { createTestQueryClient } from '../testQueryClient';

const mockGoBack = jest.fn();
const mockShowToast = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
}));
jest.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../../lib/bookingRequest', () => ({
    getBookingRequestKey: jest.fn(async () => '11111111-2222-4333-8444-555555555555'),
    acknowledgeBookingRequest: jest.fn(async () => undefined),
}));
jest.mock('../../hooks/useCurrentStaff', () => ({
    useCurrentStaff: () => ({
        staffInfo: {
            id: 'st1', full_name: 'Aida', biz_id: 'biz-1', created_at: null,
            branch: { id: 'br-1', name: 'Центр' },
            business: { id: 'biz-1', name: 'Salon', tz: 'Asia/Bishkek' },
        },
        isLoading: false,
    }),
}));

const mockedSupabase = supabase as unknown as { from: jest.Mock; rpc: jest.Mock; auth: { getSession: jest.Mock } };

function builder(result: unknown) {
    const chain: Record<string, jest.Mock> = {};
    for (const method of ['select', 'eq', 'order']) chain[method] = jest.fn(() => chain);
    (chain as unknown as { then: unknown }).then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
}

describe('StaffCreateBookingScreen (web /staff/bookings "Создать запись")', () => {
    beforeEach(() => {
        const later = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
        mockedSupabase.from.mockImplementation((table: string) => table === 'branches'
            ? builder({ data: [{ id: 'br-1', name: 'Центр', is_active: true }], error: null })
            : builder({ data: [{ id: 's1', name_ru: 'Стрижка', duration_min: 45, active: true, branch_id: 'br-1' }], error: null }));
        mockedSupabase.rpc.mockResolvedValue({ data: [{ staff_id: 'st1', branch_id: 'br-1', start_at: later, end_at: later }], error: null });
        mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
        (apiRequest as jest.Mock).mockResolvedValue({ ok: true, data: { booking_id: 'bk-12345678-x', confirmed: true } });
    });

    test('books a client in a free slot of the master', async () => {
        render(<QueryClientProvider client={createTestQueryClient()}><StaffCreateBookingScreen /></QueryClientProvider>);

        fireEvent.press(await screen.findByTestId('staff-booking-service-s1'));
        await waitFor(() => expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_free_slots_service_day_v2', expect.objectContaining({
            p_biz_id: 'biz-1', p_service_id: 's1', p_staff_id: 'st1',
        })));
        fireEvent.changeText(screen.getByTestId('staff-booking-client-name'), 'Бакыт');
        fireEvent.changeText(screen.getByTestId('staff-booking-client-phone'), '+996555123456');
        await waitFor(() => expect(screen.getByText('Создать запись')).toBeTruthy());
        fireEvent.press(screen.getAllByText('Создать запись').at(-1)!);

        await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/bookings/internal', expect.objectContaining({ method: 'POST' })));
        const body = JSON.parse((apiRequest as jest.Mock).mock.calls[0][1].body as string);
        expect(body).toEqual(expect.objectContaining({
            mode: 'simple', biz_id: 'biz-1', branch_id: 'br-1', staff_id: 'st1', service_id: 's1', client_name: 'Бакыт', client_phone: '+996555123456',
        }));
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Создана запись #bk-12345', 'success'));
        expect(mockGoBack).toHaveBeenCalled();
    });
});
