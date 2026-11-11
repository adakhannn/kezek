import { GET } from '@/app/api/staff/shift/today/route';
import { getStaffContext } from '@/lib/authBiz';

jest.mock('@/lib/authBiz', () => ({ getStaffContext: jest.fn() }));
jest.mock('@/lib/time', () => ({ TZ: 'Asia/Bishkek', formatDateInTz: jest.fn(() => '2024-01-15') }));
jest.mock('@/lib/scheduling/config', () => ({ explicitSchedulingEnabled: () => false }));

function query(data: unknown) {
    const response = { data, error: null };
    const builder = { select: jest.fn(), eq: jest.fn(), is: jest.fn(), lte: jest.fn(), gte: jest.fn(),
        neq: jest.fn(), order: jest.fn(), maybeSingle: jest.fn().mockResolvedValue(response),
        then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve) };
    for (const method of [builder.select, builder.eq, builder.is, builder.lte, builder.gte, builder.neq, builder.order]) method.mockReturnValue(builder);
    return builder;
}

describe('/api/staff/shift/today', () => {
    const mockSupabase = { from: jest.fn(), rpc: jest.fn() };
    let hourlyRate: number | null;
    let dayOff: boolean;
    const history = [{ id: 'closed-shift', shift_date: '2024-01-14', status: 'closed', total_amount: 5000,
        master_share: 3000, salon_share: 2000, late_minutes: 10, guaranteed_amount: 0, topup_amount: 0 }];
    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabase.from.mockReset();
        mockSupabase.rpc.mockReset();
        jest.useFakeTimers().setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
        hourlyRate = null; dayOff = false;
        (getStaffContext as jest.Mock).mockResolvedValue({ supabase: mockSupabase, staffId: 'staff-1', bizId: 'biz-1' });
        mockSupabase.from.mockImplementation((table: string) => {
            switch (table) {
                case 'staff': return query({ percent_master: 60, percent_salon: 40, hourly_rate: hourlyRate });
                case 'staff_time_off': return query(dayOff ? [{ id: 'time-off-1' }] : []);
                case 'staff_schedule_rules': return query(null);
                case 'working_hours': return query({ intervals: [{ start: '09:00', end: '18:00' }] });
                case 'bookings': return query([]);
                case 'service_staff': return query([{ services: { name_ru: 'Service 1', name_ky: null, name_en: null } }]);
                default: throw new Error('Unexpected table: ' + table);
            }
        });
        mockSupabase.rpc.mockImplementation(async (name: string) => {
            if (name === 'read_staff_shift_snapshot') return { data: null, error: null };
            if (name === 'read_staff_finance_history') return { data: [], error: null };
            throw new Error('Unexpected RPC: ' + name);
        });
    });
    afterEach(() => jest.useRealTimers());

    test('returns today shift data when an open shift exists', async () => {
        hourlyRate = 100;
        mockSupabase.rpc.mockResolvedValueOnce({ data: { id: 'shift-1', shift_date: '2024-01-15', status: 'open',
            opened_at: '2024-01-15T09:00:00.000Z', ledger_revision: 7, total_amount: 0, master_share: 0, salon_share: 0,
            staff_shift_items: [{ id: 'item-1', client_name: 'Client 1', service_name: 'Haircut', service_amount: 1000, consumables_amount: 100 }] }, error: null })
            .mockResolvedValueOnce({ data: history, error: null });
        const response = await GET(); const data = await response.json(); const payload = data.data;
        expect(response.status).toBe(200); expect(data.ok).toBe(true);
        expect(payload.today.exists).toBe(true); expect(payload.today.status).toBe('open');
        expect(payload.today.items).toHaveLength(1); expect(payload.today.shift.ledger_revision).toBe(7);
        expect(payload.hourlyRate).toBe(100); expect(payload.currentHoursWorked).toBe(3);
        expect(payload.currentGuaranteedAmount).toBe(300); expect(payload.stats.totalAmount).toBe(5000);
        expect(mockSupabase.rpc).toHaveBeenNthCalledWith(1, 'read_staff_shift_snapshot', {
            p_biz_id: 'biz-1', p_staff_id: 'staff-1', p_shift_date: '2024-01-15',
        });
        expect(mockSupabase.rpc).toHaveBeenNthCalledWith(2, 'read_staff_finance_history', {
            p_biz_id: 'biz-1', p_staff_id: 'staff-1', p_date_from: null, p_date_to: null,
        });
    });
    test('returns no-shift payload when there is no open shift', async () => {
        const response = await GET(); const data = await response.json();
        expect(response.status).toBe(200); expect(data.ok).toBe(true);
        expect(data.data.today.exists).toBe(false); expect(data.data.today.status).toBe('none');
        expect(data.data.hourlyRate).toBeNull();
    });
    test('marks the day as off when time off exists', async () => {
        dayOff = true;
        const response = await GET(); const data = await response.json();
        expect(response.status).toBe(200); expect(data.ok).toBe(true); expect(data.data.isDayOff).toBe(true);
    });
    test('returns 500 when loading today shift fails', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'shift load failed' } });
        const response = await GET(); const data = await response.json();
        expect(response.status).toBe(500); expect(data.ok).toBe(false); expect(data.error).toBe('internal');
        expect(data.message).toBe('shift load failed'); expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    });
    test('returns 500 when loading aggregated stats fails', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })
            .mockResolvedValueOnce({ data: null, error: { message: 'stats failed' } });
        const response = await GET(); const data = await response.json();
        expect(response.status).toBe(500); expect(data.ok).toBe(false); expect(data.error).toBe('internal');
        expect(data.message).toBe('Failed to load complete staff finance history');
        expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });
    test.each([{ ledger_revision: 7 }, { staff_shift_items: [] }])('rejects incomplete ledger %j', async snapshot => {
        mockSupabase.rpc.mockResolvedValueOnce({ data: snapshot, error: null });
        const response = await GET(); expect(response.status).toBe(500);
        expect((await response.json()).message).toBe('Incomplete shift ledger snapshot');
    });
    test('returns 401 for unauthorized staff context failures', async () => {
        (getStaffContext as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));
        const response = await GET(); const data = await response.json();
        expect(response.status).toBe(401); expect(data.ok).toBe(false); expect(data.error).toBe('auth');
        expect(mockSupabase.from).not.toHaveBeenCalled(); expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
});
