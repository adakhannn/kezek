import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { apiRequest } from '../../../lib/api';
import AdminBusinessesScreen from '../../../screens/admin/AdminBusinessesScreen';
import AdminBusinessScreen from '../../../screens/admin/AdminBusinessScreen';
import AdminCategoriesScreen from '../../../screens/admin/AdminCategoriesScreen';
import AdminHomeScreen from '../../../screens/admin/AdminHomeScreen';
import AdminRoleApplicationsScreen from '../../../screens/admin/AdminRoleApplicationsScreen';
import { withAdminGuard } from '../../../screens/admin/adminUi';
import { CabinetWorkspacesBlock } from '../../../screens/cabinet/CabinetWorkspacesBlock';
import { createTestQueryClient } from '../../testQueryClient';

jest.mock('../../../lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

const mockRole = { isSuperAdmin: true, isBusinessManager: false, isStaff: false, isOwner: false, isLoading: false };
jest.mock('../../../hooks/useUserRole', () => ({ useUserRole: () => mockRole }));

const mockConfirm = jest.fn();
const mockShowToast = jest.fn();
jest.mock('../../../contexts/ConfirmContext', () => ({ useConfirm: () => ({ confirm: mockConfirm }) }));
jest.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;

function renderWith(node: React.ReactElement) {
    return render(<QueryClientProvider client={createTestQueryClient()}>{node}</QueryClientProvider>);
}

const props = (params: Record<string, unknown>) =>
    ({ navigation: { navigate: mockNavigate, goBack: mockGoBack, replace: jest.fn() }, route: { key: 'k', name: 'x', params } }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(() => {
    jest.clearAllMocks();
    mockRole.isSuperAdmin = true;
    mockConfirm.mockResolvedValue(true);
});

describe('admin entry and access', () => {
    test('a super admin finds "Админ-панель" in the cabinet workspaces and it opens AdminHome', () => {
        render(<CabinetWorkspacesBlock />);
        fireEvent.press(screen.getByTestId('cabinet-admin-panel'));
        expect(mockNavigate).toHaveBeenCalledWith('AdminHome');
        expect(screen.getByText('Админ-панель')).toBeTruthy();
    });

    test('anyone else sees no entry, and a guarded screen says super admin rights are needed', () => {
        mockRole.isSuperAdmin = false;
        render(<CabinetWorkspacesBlock />);
        expect(screen.queryByTestId('cabinet-admin-panel')).toBeNull();

        const Guarded = withAdminGuard(() => null);
        render(<Guarded />);
        expect(screen.getByText('Нужны права супер-админа')).toBeTruthy();
    });
});

describe('AdminHomeScreen (/admin)', () => {
    test('shows the sections, platform counts, today\'s bookings and the newest businesses', async () => {
        api.mockResolvedValue({
            ok: true,
            configured: true,
            checks: { serviceRoleKey: true, siteOrigin: false, supabaseKeys: true },
            day: { label: '2026-11-26' },
            counts: { businesses: 12345, branches: 20, staff: 40, services: 80, bookings: 900, categories: 7 },
            latestBusinesses: [{ id: 'biz-1', name: 'Low Fade', slug: 'low-fade', created_at: '2026-11-25T08:00:00Z' }],
            todayBookings: [{
                id: 'bk1', start_at: '2026-11-26T04:00:00Z', end_at: '2026-11-26T05:00:00Z', status: 'hold',
                client: 'Айбек', service: 'Стрижка', staff: 'Нурлан', biz: 'Low Fade', bizId: 'biz-1', branch: 'Центр',
            }],
            failures: [],
        });
        renderWith(<AdminHomeScreen />);
        expect(await screen.findByText('12 345')).toBeTruthy();
        expect(api).toHaveBeenCalledWith('/admin/api/overview');
        expect(screen.getByText('10:00–11:00 · Low Fade')).toBeTruthy();
        expect(screen.getByText('Ожидание · 1')).toBeTruthy();
        expect(screen.getByText('Проверь .env')).toBeTruthy();

        fireEvent.press(screen.getByTestId('admin-menu-users'));
        expect(mockNavigate).toHaveBeenCalledWith('AdminUsers');
        fireEvent.press(screen.getByText('/b/low-fade'));
        expect(mockNavigate).toHaveBeenCalledWith('AdminBusiness', { bizId: 'biz-1', bizName: 'Low Fade' });
    });

    test('a failed read is an error with a retry, not an empty panel', async () => {
        api.mockRejectedValue(Object.assign(new Error('down'), { status: 503 }));
        renderWith(<AdminHomeScreen />);
        expect(await screen.findByTestId('admin-retry-retry')).toBeTruthy();
    });
});

describe('AdminBusinessesScreen (/admin/businesses)', () => {
    test('searches and filters the list by status', async () => {
        api.mockResolvedValue({
            ok: true,
            items: [
                { id: '1', slug: 'low-fade', name: 'Low Fade', owner_id: 'u', created_at: null, is_approved: true, categories: [], address: null, owner_name: 'Айбек', branches_count: 2, staff_count: 3 },
                { id: '2', slug: 'nail-bar', name: 'Nail Bar', owner_id: null, created_at: null, is_approved: false, categories: [], address: null, owner_name: null, branches_count: 0, staff_count: 0 },
            ],
        });
        renderWith(<AdminBusinessesScreen />);
        expect(await screen.findByText('Low Fade')).toBeTruthy();
        expect(screen.getByText('Nail Bar')).toBeTruthy();
        expect(screen.getByText('Владелец: Айбек')).toBeTruthy();

        fireEvent.press(screen.getByTestId('admin-businesses-filter-moderation'));
        await waitFor(() => expect(screen.queryByText('Low Fade')).toBeNull());
        expect(screen.getByText('Nail Bar')).toBeTruthy();

        fireEvent.changeText(screen.getByTestId('admin-businesses-search'), 'zzz');
        expect(await screen.findByText('Ничего не найдено')).toBeTruthy();
    });
});

describe('AdminBusinessScreen (/admin/businesses/[id])', () => {
    const detail = {
        ok: true,
        business: {
            id: 'biz-1', name: 'Low Fade', slug: 'low-fade', categories: ['barbershop'], owner_id: null, is_approved: true,
            created_at: '2026-11-01T00:00:00Z', address: 'Чуй 120', phones: null, contact_phone: null, contact_whatsapp: null,
            contact_email: null, website_url: null, branch_limit: 2,
        },
        counts: { branches: 1, staff: 2, services: 0, bookings: 5 },
        owner: null,
        categoryOptions: [{ slug: 'barbershop', name: 'Барбершоп' }],
    };

    test('delete asks first, then calls the website route and goes back', async () => {
        api.mockImplementation(async (endpoint: string) => (endpoint.endsWith('/delete') ? { ok: true } : detail));
        renderWith(<AdminBusinessScreen {...props({ bizId: 'biz-1' })} />);
        expect((await screen.findAllByText('Барбершоп')).length).toBeGreaterThan(0);
        expect(screen.getByText('2/4')).toBeTruthy();

        fireEvent.press(screen.getByTestId('admin-business-delete'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/admin/api/businesses/biz-1/delete', { method: 'POST' }));
        expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger', title: 'Удалить бизнес' }));
        await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    });

    test('a refused delete keeps the card and shows the server answer', async () => {
        api.mockImplementation(async (endpoint: string) => {
            if (endpoint.endsWith('/delete')) throw Object.assign(new Error('У бизнеса есть история'), { status: 409 });
            return detail;
        });
        mockConfirm.mockResolvedValueOnce(true);
        renderWith(<AdminBusinessScreen {...props({ bizId: 'biz-1' })} />);
        fireEvent.press(await screen.findByTestId('admin-business-delete'));
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('У бизнеса есть история', 'error'));
        expect(mockGoBack).not.toHaveBeenCalled();
    });

    test('the branch limit cannot go below the existing branches', async () => {
        api.mockResolvedValue(detail);
        renderWith(<AdminBusinessScreen {...props({ bizId: 'biz-1' })} />);
        fireEvent.changeText(await screen.findByTestId('admin-branch-limit'), '0');
        fireEvent.press(screen.getByTestId('admin-branch-limit-save'));
        expect(await screen.findByText('Целое число от 1 до 1000')).toBeTruthy();
        expect(api).not.toHaveBeenCalledWith(expect.stringContaining('branch-limit'), expect.anything());
    });
});

describe('AdminCategoriesScreen (/admin/categories)', () => {
    test('a used category is deleted from its businesses too, after the confirmation names them', async () => {
        api.mockImplementation(async (endpoint: string) => (endpoint.endsWith('/delete')
            ? { ok: true }
            : { ok: true, items: [{ id: 'c1', name_ru: 'Барбершоп', slug: 'barbershop', is_active: true, usage_count: 3 }] }));
        renderWith(<AdminCategoriesScreen />);
        expect(await screen.findByText('/b/barbershop · 3 бизнеса')).toBeTruthy();
        fireEvent.press(screen.getByTestId('admin-category-delete-barbershop'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/admin/api/categories/c1/delete', { method: 'POST', body: JSON.stringify({ force: true }) }));
        expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Также убрать категорию из 3 бизнесов') }));
    });

    test('nothing is deleted when the confirmation is declined', async () => {
        mockConfirm.mockResolvedValue(false);
        api.mockResolvedValue({ ok: true, items: [{ id: 'c1', name_ru: 'Барбершоп', slug: 'barbershop', is_active: true, usage_count: 0 }] });
        renderWith(<AdminCategoriesScreen />);
        fireEvent.press(await screen.findByTestId('admin-category-delete-barbershop'));
        await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
        expect(api).not.toHaveBeenCalledWith(expect.stringContaining('/delete'), expect.anything());
    });
});

describe('AdminRoleApplicationsScreen (/admin/role-applications)', () => {
    test('a rejection needs a reason; reject and block sends 30 days', async () => {
        api.mockImplementation(async (endpoint: string) => (endpoint.includes('/status')
            ? { ok: true }
            : {
                ok: true,
                items: [{
                    id: 'ra1', applicant_user_id: 'u1', biz_id: 'b1', requested_role: 'manager', status: 'pending',
                    applicant_name: 'Айбек', applicant_email: 'a@b.kg', applicant_phone: null, message: null,
                    created_at: '2026-11-20T10:00:00Z', reviewed_at: null, review_note: null, evidence_links: {},
                    prior_submission_count: 0, risk_flags: [], active_block_id: null, businesses: { name: 'Low Fade', slug: 'low-fade' },
                }],
            }));
        renderWith(<AdminRoleApplicationsScreen />);
        expect(await screen.findByText('Айбек')).toBeTruthy();
        expect(api).toHaveBeenCalledWith('/admin/api/role-applications?status=pending');

        fireEvent.press(screen.getByTestId('admin-role-reject-ra1'));
        fireEvent.press(screen.getByTestId('admin-reason-ra1:reject:block'));
        expect(api).not.toHaveBeenCalledWith(expect.stringContaining('/status'), expect.anything());

        fireEvent.changeText(screen.getByTestId('admin-reason'), 'Нет связи с бизнесом');
        fireEvent.press(screen.getByTestId('admin-reason-ra1:reject:block'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/admin/api/role-applications/ra1/status', {
            method: 'POST',
            body: JSON.stringify({ action: 'reject', note: 'Нет связи с бизнесом', block_days: 30 }),
        }));
    });
});
