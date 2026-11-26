import { createTranslate } from '../../../i18n';
import { apiRequest } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import {
    canSubmitClient,
    createInternalBooking,
    internalBookingInput,
    quickDeskClientPayload,
    servicesForMaster,
    staffWorkingInBranch,
    targetBranchFor,
    temporaryTransfersFor,
    type ClientState,
} from '../../../screens/manage/bookings/quickDesk';

jest.mock('../../../lib/api', () => ({ apiRequest: jest.fn() }));
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { mockStore.delete(key); }),
}));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;
const getSession = supabase.auth.getSession as jest.Mock;
const t = createTranslate('ru');

const none: ClientState = { mode: 'none', selectedClientId: '', foundUsers: [], searchLoading: false, newClientName: '', newClientPhone: '' };
const user = { id: '11111111-1111-4111-8111-111111111111', full_name: 'Айбек', email: null, phone: '+996555000111' };

describe('QuickDesk client', () => {
    test('no client, an account from the search, or a new name and phone', () => {
        expect(quickDeskClientPayload(none, t)).toEqual({ ok: true, payload: { clientId: null, clientName: null, clientPhone: null } });
        expect(quickDeskClientPayload({ ...none, mode: 'existing', foundUsers: [user], selectedClientId: user.id }, t))
            .toEqual({ ok: true, payload: { clientId: user.id, clientName: null, clientPhone: null } });
        expect(quickDeskClientPayload({ ...none, mode: 'new', newClientName: ' Айбек ', newClientPhone: '+996555123456' }, t))
            .toEqual({ ok: true, payload: { clientId: null, clientName: 'Айбек', clientPhone: '+996555123456' } });
    });

    test('an account must be chosen from a finished search; a new client needs a valid name and E.164 phone', () => {
        expect(quickDeskClientPayload({ ...none, mode: 'existing', foundUsers: [user], selectedClientId: user.id, searchLoading: true }, t))
            .toEqual({ ok: false, error: 'Выбери клиента' });
        expect(quickDeskClientPayload({ ...none, mode: 'new', newClientName: '', newClientPhone: '+996555123456' }, t))
            .toEqual({ ok: false, error: 'Введите имя клиента' });
        expect(quickDeskClientPayload({ ...none, mode: 'new', newClientName: 'А', newClientPhone: '+996555123456' }, t).ok).toBe(false);
        expect(quickDeskClientPayload({ ...none, mode: 'new', newClientName: 'Айбек', newClientPhone: '0555123456' }, t))
            .toEqual({ ok: false, error: 'Введите корректный номер телефона' });
        expect(canSubmitClient({ ...none, mode: 'new', newClientName: 'Айбек', newClientPhone: '' })).toBe(false);
        expect(canSubmitClient({ ...none, mode: 'existing', foundUsers: [user], selectedClientId: 'other' })).toBe(false);
    });
});

describe('who works where that day', () => {
    const staff = [
        { id: 's-1', full_name: 'Азамат', branch_id: 'br-1' },
        { id: 's-2', full_name: 'Бек', branch_id: 'br-2' },
    ];
    const locations = [
        { staff_id: 's-2', branch_id: 'br-1', date_on: '2026-11-26' },
        { staff_id: 's-1', branch_id: 'br-1', date_on: '2026-11-26' },
    ];

    test('a master at another branch than home is a transfer; the visitor works there, not at home', () => {
        const transfers = temporaryTransfersFor(locations, staff);
        expect(transfers).toEqual([{ staff_id: 's-2', branch_id: 'br-1', date: '2026-11-26' }]);
        expect(staffWorkingInBranch(staff, 'br-1', '2026-11-26', transfers).map((member) => member.id)).toEqual(['s-1', 's-2']);
        expect(staffWorkingInBranch(staff, 'br-2', '2026-11-26', transfers)).toEqual([]);
        expect(targetBranchFor(staff, 's-2', 'br-1', '2026-11-26', transfers)).toBe('br-1');
    });

    test('services are those the master performs at the branch of the day', () => {
        const services = [
            { id: 'sv-1', name_ru: 'Стрижка', name_ky: null, name_en: null, duration_min: 30, branch_id: 'br-1' },
            { id: 'sv-2', name_ru: 'Борода', name_ky: null, name_en: null, duration_min: 15, branch_id: 'br-1' },
            { id: 'sv-3', name_ru: 'Стрижка', name_ky: null, name_en: null, duration_min: 30, branch_id: 'br-2' },
        ];
        const map = new Map([['sv-1', new Set(['s-1'])], ['sv-3', new Set(['s-2'])]]);
        expect(servicesForMaster({ services, staff, staffId: 's-1', branchId: 'br-1', date: '2026-11-26', transfers: [], serviceToStaffMap: map })
            .map((service) => service.id)).toEqual(['sv-1']);
        // A visiting master may take the same service of the host branch (same name and duration).
        const transfers = temporaryTransfersFor(locations, staff);
        expect(servicesForMaster({ services, staff, staffId: 's-2', branchId: 'br-1', date: '2026-11-26', transfers, serviceToStaffMap: map })
            .map((service) => service.id)).toEqual(['sv-1']);
        expect(servicesForMaster({ services, staff, staffId: '', branchId: 'br-1', date: '2026-11-26', transfers, serviceToStaffMap: map })).toEqual([]);
    });
});

describe('createInternalBooking (POST /api/bookings/internal)', () => {
    const input = internalBookingInput({
        bizId: 'biz-1', branchId: 'br-1', staffId: 's-1', serviceId: 'sv-1', startAt: '2026-11-26T09:00:00.000Z', durationMin: 30,
        client: { clientId: null, clientName: 'Айбек', clientPhone: '+996555123456' },
    });

    beforeEach(() => {
        api.mockReset();
        getSession.mockResolvedValue({ data: { session: { user: { id: 'manager-1' }, access_token: 'x' } } });
    });

    test('the body is the website\'s simple mode', () => {
        expect(input).toEqual({
            mode: 'simple', biz_id: 'biz-1', branch_id: 'br-1', staff_id: 's-1', service_id: 'sv-1',
            start_at: '2026-11-26T09:00:00.000Z', duration_min: 30, client_id: null, client_name: 'Айбек', client_phone: '+996555123456',
        });
    });

    test('a retry after a lost answer sends the same Idempotency-Key; a confirmed answer ends the attempt', async () => {
        api.mockRejectedValueOnce(new Error('Network request failed'));
        await expect(createInternalBooking(input, t)).rejects.toThrow('Network request failed');
        api.mockResolvedValueOnce({ ok: true, data: { booking_id: 'b-1', confirmed: true } });
        await expect(createInternalBooking(input, t)).resolves.toBe('b-1');
        const keys = api.mock.calls.map(([, options]) => (options?.headers as Record<string, string>)['Idempotency-Key']);
        expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
        expect(keys[1]).toBe(keys[0]);
        expect(api.mock.calls[0][0]).toBe('/api/bookings/internal');
        expect(JSON.parse(String(api.mock.calls[0][1]?.body))).toEqual(input);

        api.mockResolvedValueOnce({ ok: true, data: { booking_id: 'b-2', confirmed: true } });
        await createInternalBooking(input, t);
        expect((api.mock.calls[2][1]?.headers as Record<string, string>)['Idempotency-Key']).not.toBe(keys[0]);
    });

    test('an unconfirmed answer is an error; no session is a sign-in error', async () => {
        api.mockResolvedValueOnce({ ok: true, data: { booking_id: 'b-1', confirmed: false } });
        await expect(createInternalBooking(input, t)).rejects.toThrow('Результат записи не подтверждён. Повторите ту же запись.');
        getSession.mockResolvedValueOnce({ data: { session: null } });
        await expect(createInternalBooking(input, t)).rejects.toThrow('Войдите в аккаунт для создания записи');
    });
});
