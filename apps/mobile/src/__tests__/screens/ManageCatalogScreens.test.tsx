import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api';
import BranchesScreen from '../../screens/manage/catalog/BranchesScreen';
import BusinessSettingsScreen from '../../screens/manage/catalog/BusinessSettingsScreen';
import ServiceEditScreen from '../../screens/manage/catalog/ServiceEditScreen';
import ServicesScreen from '../../screens/manage/catalog/ServicesScreen';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../../screens/manage/currentBusiness', () => ({ ensureCurrentBusiness: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockConfirm = jest.fn();
const mockShowToast = jest.fn();
jest.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => ({ confirm: mockConfirm }) }));
jest.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const params = { bizId: 'biz-1', bizName: 'Low Fade', tz: 'Asia/Bishkek' };

const overview = {
    services: [
        { name_ru: 'Стрижка', name_ky: null, name_en: null, duration_min: 45, price_from: 500, price_to: 700, active: true, branch_ids: ['b1', 'b2'], first_id: 's1' },
        { name_ru: 'Борода', name_ky: null, name_en: null, duration_min: 30, price_from: 300, price_to: 300, active: false, branch_ids: ['b2'], first_id: 's2' },
    ],
    branches: [{ id: 'b1', name: 'Центр' }, { id: 'b2', name: 'Юг' }],
    bizName: 'Low Fade',
    bizCity: null,
};

function renderWith(node: React.ReactElement) {
    return render(<QueryClientProvider client={createTestQueryClient()}>{node}</QueryClientProvider>);
}

// The screens get navigation/route from the stack; the tests pass the parts they use.
const props = (routeParams: Record<string, unknown>) => ({ navigation, route: { key: 'k', name: 'x', params: routeParams } }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
});

describe('ServicesScreen (/dashboard/services)', () => {
    test('lists the grouped services with branches, status and price; filters by branch', async () => {
        api.mockResolvedValue({ ok: true, data: overview });
        renderWith(<ServicesScreen {...props(params)} />);
        expect(await screen.findByText('Стрижка')).toBeTruthy();
        expect(screen.getByText('Филиалы: Центр, Юг (2)')).toBeTruthy();
        expect(screen.getByText('активна')).toBeTruthy();
        expect(screen.getByText('скрыта')).toBeTruthy();
        expect(screen.getByText('Длительность: 45 мин')).toBeTruthy();
        expect(api).toHaveBeenCalledWith('/dashboard/services', undefined);

        fireEvent.press(screen.getByTestId('services-filter-b2'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/dashboard/services?branch=b2', undefined));
    });

    test('delete asks first; a service with history is switched off, as the website says', async () => {
        api.mockImplementation(async (endpoint: string) => (endpoint.endsWith('/delete')
            ? { ok: true, archived: true }
            : { ok: true, data: overview }));
        renderWith(<ServicesScreen {...props(params)} />);
        fireEvent.press(await screen.findByLabelText('Удалить: Стрижка'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/services/s1/delete', { method: 'POST' }));
        expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Удалить услугу?', variant: 'danger' }));
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('не удалена, а выключена'), 'success'));
    });

    test('a refused delete with bookings shows the counts', async () => {
        api.mockImplementation(async (endpoint: string) => {
            if (endpoint.endsWith('/delete')) {
                throw Object.assign(new Error('Есть брони'), {
                    status: 400,
                    details: { ok: false, error: 'HAS_BOOKINGS', message: 'Есть брони', details: { total: 2, active: 2, cancelled: 0, bookings: [] } },
                });
            }
            return { ok: true, data: overview };
        });
        renderWith(<ServicesScreen {...props(params)} />);
        fireEvent.press(await screen.findByLabelText('Удалить: Борода'));
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Всего броней: 2'), 'error'));
    });
});

describe('ServiceEditScreen (/dashboard/services/new)', () => {
    test('shows the website validation, then creates the service with the chosen branches', async () => {
        api.mockImplementation(async (endpoint: string) => (endpoint === '/services/create' ? { ok: true, data: { id: 'new' } } : { ok: true, data: overview }));
        renderWith(<ServiceEditScreen {...props(params)} />);
        fireEvent.press(await screen.findByText('Сохранить'));
        expect(await screen.findByText('Проверьте выделенные поля')).toBeTruthy();
        expect(screen.getByText('Название обязательно')).toBeTruthy();
        expect(screen.getByText('Выберите хотя бы один филиал')).toBeTruthy();

        fireEvent.changeText(screen.getByTestId('service-name-ru'), 'Укладка');
        fireEvent.press(screen.getByTestId('service-branch-b1'));
        fireEvent.press(screen.getByText('Сохранить'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/services/create', expect.objectContaining({ method: 'POST' })));
        const body = JSON.parse((api.mock.calls.find(([e]) => e === '/services/create')![1] as RequestInit).body as string);
        expect(body).toEqual({
            name_ru: 'Укладка', name_ky: null, name_en: null, duration_min: 60, price_from: 0, price_to: 0, active: true, branch_ids: ['b1'],
        });
        await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    });
});

describe('BranchesScreen (/dashboard/branches)', () => {
    test('shows usage and the limit notice; no add button over the limit', async () => {
        api.mockResolvedValue({ ok: true, data: {
            branches: [{ id: 'b1', name: 'Центр', address: 'Чуй 1', is_active: true }],
            branchLimit: 1, isSuperAdmin: false, canManageBranches: true, canCreateBranch: false,
            businessSlug: 'low-fade', businessName: 'Low Fade',
            businessContacts: { contact_phone: null, contact_whatsapp: null, contact_email: null, website_url: null },
        } });
        renderWith(<BranchesScreen {...props(params)} />);
        expect(await screen.findByText('Использовано филиалов: 1 из 1')).toBeTruthy();
        expect(screen.getByText('Лимит филиалов достигнут')).toBeTruthy();
        expect(screen.queryByText('Добавить филиал')).toBeNull();
        expect(screen.getByText('Адрес: Чуй 1')).toBeTruthy();
    });
});

describe('BusinessSettingsScreen (/dashboard/settings)', () => {
    test('a manager gets the page\'s no-access notice', async () => {
        api.mockRejectedValue(Object.assign(new Error('forbidden'), { status: 403, details: { ok: false, error: 'forbidden' } }));
        renderWith(<BusinessSettingsScreen {...props(params)} />);
        expect(await screen.findByText('Нет доступа')).toBeTruthy();
    });

    test('the owner saves the contacts; the time zone save stays off until it changes', async () => {
        const settings = { contact_phone: '+996555000111', contact_whatsapp: null, contact_email: null, website_url: null, tz: 'Asia/Bishkek' };
        api.mockImplementation(async (_endpoint: string, init?: RequestInit) => (init?.method === 'POST'
            ? { ok: true, data: { ...settings, contact_email: 'hi@example.com' } }
            : { ok: true, data: settings }));
        renderWith(<BusinessSettingsScreen {...props(params)} />);
        expect(await screen.findByDisplayValue('+996555000111')).toBeTruthy();
        fireEvent.changeText(screen.getByTestId('settings-contact_email'), 'hi@example.com');
        fireEvent.press(screen.getByText('Сохранить контакты'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/dashboard/contact-settings', expect.objectContaining({ method: 'POST' })));
        const body = JSON.parse((api.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === 'POST')![1] as RequestInit).body as string);
        expect(body).toEqual({ contact_phone: '+996555000111', contact_whatsapp: '', contact_email: 'hi@example.com', website_url: '' });
        expect(await screen.findByText('Публичные контакты сохранены')).toBeTruthy();
    });
});
