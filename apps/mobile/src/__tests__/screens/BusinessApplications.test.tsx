import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { NavigationSessionProvider } from '../../navigation/NavigationSessionContext';
import BusinessApplyScreen from '../../screens/apply/BusinessApplyScreen';
import RoleApplicationScreen from '../../screens/apply/RoleApplicationScreen';
import RoleApplyScreen from '../../screens/apply/RoleApplyScreen';
import {
    PROPOSE_CATEGORY_VALUE,
    applicationBusinessName,
    businessApplicationError,
    businessApplicationErrorKey,
    roleApplicationError,
    selectApplicationEmail,
    selectApplicationPhone,
    EMPTY_BUSINESS_APPLICATION,
    EMPTY_EVIDENCE,
} from '../../screens/apply/applicationModel';
import { createTestQueryClient } from '../testQueryClient';

const mockNavigate = jest.fn();
let mockRouteParams: Record<string, unknown> = {};

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));

const mockedApi = apiRequest as jest.Mock;
const mockedSupabase = supabase as unknown as { auth: { getUser: jest.Mock }; from: jest.Mock };

function renderSignedIn(element: React.ReactElement, hasSession = true) {
    return render(
        <QueryClientProvider client={createTestQueryClient()}>
            <NavigationSessionProvider value={{ session: null, hasSession }}>{element}</NavigationSessionProvider>
        </QueryClientProvider>,
    );
}

/** A Supabase query builder answering `result` whatever the filters. */
function builder(result: unknown) {
    const chain: Record<string, jest.Mock> = {};
    for (const method of ['select', 'eq', 'order', 'in', 'neq', 'gte', 'lt']) chain[method] = jest.fn(() => chain);
    chain.maybeSingle = jest.fn().mockResolvedValue(result);
    (chain as unknown as { then: unknown }).then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
}

describe('application rules (web business apply / role apply)', () => {
    test('prefill e-mail: the account address unless internal, else a verified notification address', () => {
        expect(selectApplicationEmail({ accountEmail: ' Owner@Mail.kg ' })).toBe('owner@mail.kg');
        expect(selectApplicationEmail({
            accountEmail: '996555@whatsapp.kezek.kg',
            notificationEmails: [{ email: 'a@x.kg', enabled: false }, { email: 'b@x.kg', enabled: true }, { email: 'c@x.kg', verified: false, enabled: true }],
        })).toBe('b@x.kg');
    });

    test('prefill phone: profile, account, metadata, then a confirmed WhatsApp number', () => {
        expect(selectApplicationPhone({ profilePhone: ' ', accountPhone: '+996111' })).toBe('+996111');
        expect(selectApplicationPhone({ whatsAppPhone: '+996222', whatsAppVerified: false })).toBe('');
        expect(selectApplicationPhone({ whatsAppPhone: '+996222', whatsAppVerified: true })).toBe('+996222');
    });

    test('form checks and API error codes', () => {
        const form = { ...EMPTY_BUSINESS_APPLICATION, contact_name: 'Aida', phone: '+996555', email: 'a@x.kg', business_name: 'Salon' };
        expect(businessApplicationError({ ...form, email: '' }, 'beauty', '')).toBe('parity.apply.error.requiredFields');
        expect(businessApplicationError({ ...form, email: 'nope' }, 'beauty', '')).toBe('parity.apply.error.invalidEmail');
        expect(businessApplicationError(form, '', '')).toBe('parity.apply.error.categoryRequired');
        expect(businessApplicationError(form, PROPOSE_CATEGORY_VALUE, ' ')).toBe('parity.apply.error.proposedCategoryRequired');
        expect(businessApplicationError(form, 'beauty', '')).toBeNull();
        expect(businessApplicationErrorKey({ details: { code: 'business_exists' } })).toBe('parity.apply.error.businessExists');
        expect(businessApplicationErrorKey(new Error('x'))).toBe('parity.apply.error.submit');
    });

    test('owner applications need a detailed note or a link', () => {
        expect(roleApplicationError({ mode: 'owner', bizId: '', message: '', evidence: EMPTY_EVIDENCE })).toBe('parity.roleApply.form.errors.selectBusiness');
        expect(roleApplicationError({ mode: 'owner', bizId: 'b', message: 'short', evidence: EMPTY_EVIDENCE })).toBe('parity.roleApply.form.errors.ownerEvidence');
        expect(roleApplicationError({ mode: 'owner', bizId: 'b', message: '', evidence: { ...EMPTY_EVIDENCE, instagram: 'https://i' } })).toBeNull();
        expect(roleApplicationError({ mode: 'staff', bizId: 'b', message: '', evidence: EMPTY_EVIDENCE })).toBeNull();
        expect(applicationBusinessName({ id: '1', biz_id: 'b1', requested_role: 'staff', status: 'pending', created_at: '', businesses: [{ name: 'Aru', slug: null }] })).toBe('Aru');
    });
});

describe('BusinessApplyScreen', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockedApi.mockReset();
        mockedApi.mockResolvedValue({ ok: true, id: 'app-1' });
        mockedSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'u1', email: 'owner@mail.kg', phone: null, user_metadata: {} } },
            error: null,
        });
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === 'categories') return builder({ data: [{ slug: 'beauty', name_ru: 'Красота' }], error: null });
            if (table === 'profiles') return builder({ data: { full_name: 'Aida', phone: '+996555000111' }, error: null });
            return builder({ data: [], error: null });
        });
    });

    test('signed out: explains why and opens the sign-in', () => {
        renderSignedIn(<BusinessApplyScreen />, false);
        expect(screen.getByTestId('application-auth-gate')).toBeTruthy();
        fireEvent.press(screen.getByText('Войти и продолжить'));
        expect(mockNavigate).toHaveBeenCalledWith('Auth', { screen: 'SignIn' });
    });

    test('prefills the applicant and sends the application with the chosen category', async () => {
        renderSignedIn(<BusinessApplyScreen />);

        expect(await screen.findByDisplayValue('Aida')).toBeTruthy();
        expect(screen.getByDisplayValue('owner@mail.kg')).toBeTruthy();
        fireEvent.press(screen.getByText('Отправить заявку'));
        expect(await screen.findByText('Укажите имя, название бизнеса, телефон и email.')).toBeTruthy();

        fireEvent.changeText(screen.getByLabelText('Название бизнеса'), 'Salon Aru');
        fireEvent.press(screen.getByTestId('category-beauty'));
        fireEvent.press(screen.getByText('Отправить заявку'));

        await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/business-applications', expect.objectContaining({ method: 'POST' })));
        const body = JSON.parse(mockedApi.mock.calls[0][1].body as string);
        expect(body).toEqual(expect.objectContaining({
            contact_name: 'Aida', phone: '+996555000111', email: 'owner@mail.kg', business_name: 'Salon Aru', category: 'beauty', website: '',
        }));
        expect(await screen.findByText('Заявка отправлена')).toBeTruthy();
    });

    test('shows the text of the server code', async () => {
        mockedApi.mockRejectedValue(Object.assign(new Error('x'), { details: { ok: false, code: 'pending_duplicate' } }));
        renderSignedIn(<BusinessApplyScreen />);

        await screen.findByDisplayValue('Aida');
        fireEvent.changeText(screen.getByLabelText('Название бизнеса'), 'Salon Aru');
        fireEvent.press(screen.getByTestId(`category-${PROPOSE_CATEGORY_VALUE}`));
        fireEvent.changeText(screen.getByTestId('proposed-category-input'), 'Груминг');
        fireEvent.press(screen.getByText('Отправить заявку'));

        expect(await screen.findByText('Такая заявка уже ожидает рассмотрения.')).toBeTruthy();
        expect(JSON.parse(mockedApi.mock.calls[0][1].body as string).category).toBe('Груминг');
    });
});

describe('Role applications', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockedApi.mockReset();
        mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
        mockedSupabase.from.mockImplementation(() => builder({ data: { full_name: 'Aida' }, error: null }));
    });

    test('the chooser opens the owner or staff form', () => {
        renderSignedIn(<RoleApplyScreen />);
        fireEvent.press(screen.getByTestId('role-apply-staff'));
        expect(mockNavigate).toHaveBeenCalledWith('RoleApplication', { mode: 'staff' });
    });

    test('staff: finds a business, sends the application and withdraws a pending one', async () => {
        mockRouteParams = { mode: 'staff' };
        mockedApi.mockImplementation(async (endpoint: string, init?: RequestInit) => {
            if (endpoint.startsWith('/businesses/search')) return { ok: true, items: [{ id: 'biz-1', name: 'Salon Aru', slug: 'aru' }] };
            if (endpoint.startsWith('/business-role-applications?')) {
                return { ok: true, items: [{ id: 'app-9', biz_id: 'biz-0', requested_role: 'staff', status: 'pending', created_at: '2026-11-20T10:00:00Z', businesses: { name: 'Old Salon', slug: null } }] };
            }
            if (init?.method === 'DELETE') return { ok: true };
            return { ok: true, id: 'app-10' };
        });
        renderSignedIn(<RoleApplicationScreen />);

        expect(await screen.findByText(/Old Salon/)).toBeTruthy();
        fireEvent.changeText(screen.getByTestId('business-search-input'), 'Sal');
        fireEvent.press(await screen.findByTestId('business-option-biz-1'));
        fireEvent.press(screen.getByText('Отправить заявку'));

        await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/business-role-applications', expect.objectContaining({ method: 'POST' })));
        const post = mockedApi.mock.calls.find(([endpoint, init]) => endpoint === '/business-role-applications' && init?.method === 'POST');
        expect(JSON.parse(post?.[1].body as string)).toEqual({ biz_id: 'biz-1', requested_role: 'staff', message: '', evidence_links: EMPTY_EVIDENCE });
        expect(await screen.findByText('Заявка сотрудника отправлена в Salon Aru.')).toBeTruthy();

        fireEvent.press(screen.getByText('Отозвать'));
        await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/business-role-applications/app-9', { method: 'DELETE' }));
    });

    test('owner: refused without a detailed note or link', async () => {
        mockRouteParams = { mode: 'owner' };
        mockedApi.mockImplementation(async (endpoint: string) => {
            if (endpoint.startsWith('/businesses/search')) return { ok: true, items: [{ id: 'biz-1', name: 'Salon Aru', slug: null }] };
            if (endpoint.startsWith('/business-role-applications?')) return { ok: true, items: [] };
            return { ok: true };
        });
        renderSignedIn(<RoleApplicationScreen />);

        fireEvent.changeText(screen.getByTestId('business-search-input'), 'Salon');
        fireEvent.press(await screen.findByTestId('business-option-biz-1'));
        fireEvent.press(screen.getByText('Отправить заявку'));

        expect(await screen.findByText('Для заявки владельца добавьте подробное пояснение или хотя бы одну подтверждающую ссылку.')).toBeTruthy();
        expect(mockedApi).not.toHaveBeenCalledWith('/business-role-applications', expect.objectContaining({ method: 'POST' }));
    });
});
