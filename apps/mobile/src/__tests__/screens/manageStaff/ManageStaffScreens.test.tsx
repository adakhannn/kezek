import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { apiRequest } from '../../../lib/api';
import { MANAGE_MENU, manageMenuFor } from '../../../screens/manage/manageMenu';
import ManageStaffDetailScreen from '../../../screens/manageStaff/ManageStaffDetailScreen';
import ManageStaffListScreen from '../../../screens/manageStaff/ManageStaffListScreen';
import { createTestQueryClient } from '../../testQueryClient';

jest.mock('../../../lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../../../lib/webLinks', () => ({ openWebAsCurrentUser: jest.fn() }));
jest.mock('../../../screens/manage/currentBusiness', () => ({ ensureCurrentBusiness: jest.fn(async () => undefined) }));
jest.mock('../../../lib/supabase', () => {
    const query = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
    return { supabase: { from: jest.fn(() => query), auth: { getSession: jest.fn() } } };
});

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
    useRoute: () => ({ params: mockParams }),
}));

const mockConfirm = jest.fn();
const mockShowToast = jest.fn();
jest.mock('../../../contexts/ConfirmContext', () => ({ useConfirm: () => ({ confirm: mockConfirm }) }));
jest.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;

const LIST = {
    ok: true,
    data: {
        rows: [
            { id: 'staff-1', full_name: 'Азамат Касымов', is_active: true, branch_id: 'b1', branches: { name: 'Центр' } },
            { id: 'staff-2', full_name: 'Бакыт Уулу', is_active: false, branch_id: 'b1', branches: null },
        ],
        pendingInvitationStaffIds: ['staff-2'],
        staffApplications: null,
        business: { name: 'Low Fade', city: null },
    },
};

const DETAIL = {
    ok: true,
    data: {
        explicitScheduling: false,
        staff: { id: 'staff-1', full_name: 'Азамат Касымов', email: null, phone: null, branch_id: 'b1', is_active: true, percent_master: 60, percent_salon: 40, hourly_rate: null },
        branches: [{ id: 'b1', name: 'Центр', is_active: true }],
        reviews: [],
        ratingScore: null,
        ratingWeights: null,
    },
};

const renderWithClient = (node: React.ReactElement) => render(
    <QueryClientProvider client={createTestQueryClient()}>{node}</QueryClientProvider>,
);

beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
    mockParams = { bizId: 'biz-1', bizName: 'Low Fade', tz: 'Asia/Bishkek' };
    api.mockImplementation(async (endpoint: string) => {
        if (endpoint === '/api/dashboard/staff') return LIST;
        if (endpoint === '/api/dashboard/staff/staff-1') return DETAIL;
        return { ok: true };
    });
});

describe('business tab menu', () => {
    test('staff management is open to every managing role, like /dashboard/staff', () => {
        expect(MANAGE_MENU.find((item) => item.key === 'staff')).toMatchObject({ route: 'ManageStaff' });
        for (const role of ['owner', 'admin', 'manager'] as const) {
            expect(manageMenuFor(role).map((item) => item.key)).toContain('staff');
        }
    });
});

describe('ManageStaffListScreen (/dashboard/staff)', () => {
    test('lists the cards with status, branch and the pending invitation', async () => {
        renderWithClient(<ManageStaffListScreen />);
        expect(await screen.findByText('Азамат Касымов')).toBeTruthy();
        expect(screen.getByText('Центр')).toBeTruthy();
        expect(screen.getByText('Филиал не указан')).toBeTruthy();
        expect(screen.getByText('Ожидает подтверждения')).toBeTruthy();
        expect(screen.getByText('Отменить приглашение')).toBeTruthy();
    });

    test('dismissing asks first and then posts the website command', async () => {
        renderWithClient(<ManageStaffListScreen />);
        fireEvent.press(await screen.findByText('Уволить'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/api/staff/staff-1/dismiss', { method: 'POST' }));
        expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' }));
        expect(mockShowToast).toHaveBeenCalledWith('Сотрудник уволен.', 'success');
    });

    test('a declined confirmation sends nothing', async () => {
        mockConfirm.mockResolvedValue(false);
        renderWithClient(<ManageStaffListScreen />);
        fireEvent.press(await screen.findByText('Уволить'));
        await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
        expect(api).not.toHaveBeenCalledWith('/api/staff/staff-1/dismiss', expect.anything());
    });

    test('the search filters by name', async () => {
        renderWithClient(<ManageStaffListScreen />);
        await screen.findByText('Азамат Касымов');
        fireEvent.changeText(screen.getByTestId('manage-staff-search'), 'бакыт');
        expect(screen.queryByText('Азамат Касымов')).toBeNull();
        expect(screen.getByText('Бакыт Уулу')).toBeTruthy();
    });

    test('a refused dismissal shows the server answer', async () => {
        api.mockImplementation(async (endpoint: string) => {
            if (endpoint === '/api/dashboard/staff') return LIST;
            throw Object.assign(new Error('У сотрудника есть будущие записи'), { status: 409 });
        });
        renderWithClient(<ManageStaffListScreen />);
        fireEvent.press(await screen.findByText('Уволить'));
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('У сотрудника есть будущие записи', 'error'));
    });
});

describe('ManageStaffDetailScreen (/dashboard/staff/[id])', () => {
    beforeEach(() => {
        mockParams = { bizId: 'biz-1', bizName: 'Low Fade', tz: 'Asia/Bishkek', staffId: 'staff-1', staffName: 'Азамат Касымов' };
    });

    test('opens the card pages with the staff params', async () => {
        renderWithClient(<ManageStaffDetailScreen />);
        fireEvent.press(await screen.findByText('Финансы'));
        expect(mockNavigate).toHaveBeenCalledWith('ManageStaffFinance', expect.objectContaining({ staffId: 'staff-1', bizId: 'biz-1' }));
        expect(screen.getByText('Перевод доступен при 2+ активных филиалах')).toBeTruthy();
    });

    test('permanent delete is confirmed and posts /delete', async () => {
        renderWithClient(<ManageStaffDetailScreen />);
        fireEvent.press(await screen.findByText('Удалить навсегда'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/api/staff/staff-1/delete', { method: 'POST' }));
        expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Удалить навсегда?', variant: 'danger' }));
        expect(mockGoBack).toHaveBeenCalled();
    });

    test('saving the profile posts the website body', async () => {
        renderWithClient(<ManageStaffDetailScreen />);
        fireEvent.changeText(await screen.findByTestId('staff-form-master'), '70');
        fireEvent.press(screen.getByText('Сохранить изменения'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/api/staff/staff-1/update', expect.objectContaining({ method: 'POST' })));
        const call = api.mock.calls.find(([endpoint]) => endpoint === '/api/staff/staff-1/update');
        expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ percent_master: 70, percent_salon: 30, branch_id: 'b1', is_active: true });
    });
});
