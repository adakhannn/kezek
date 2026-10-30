import { listDashboardBookingClientIdentities } from '@/lib/dashboardBookingClientIdentityService';

function clients(bookings: {id:string}[], profiles: {id:string}[], bookingError: object | null = null, profileError: object | null = null) {
    const bookingQuery = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: bookings, error: bookingError }) };
    const profileQuery = { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: profiles, error: profileError }) };
    return { supabase: { from: jest.fn(() => bookingQuery) }, admin: { from: jest.fn(() => profileQuery) }, bookingQuery, profileQuery };
}

const linked = { id: 'booking-1', client_id: 'client-1', client_name: null };

test('resolves the linked name only after scoped and RLS-backed booking access', async () => {
    const c = clients([linked], [{ id: 'client-1', full_name: ' Known Client ' }]);
    expect(await listDashboardBookingClientIdentities({ ...c, bizId: 'authorized-biz', bookingIds: ['booking-1','foreign-booking'] })).toEqual([{ bookingId: 'booking-1', name: 'Known Client' }]);
    expect(c.bookingQuery.eq).toHaveBeenCalledWith('biz_id', 'authorized-biz');
    expect(c.bookingQuery.in).toHaveBeenCalledWith('id', ['booking-1','foreign-booking']);
    expect(c.profileQuery.in).toHaveBeenCalledWith('id', ['client-1']);
    expect(c.profileQuery.select).toHaveBeenCalledWith('id,full_name');
});

test('does not read profiles for no accessible bookings', async () => {
    const c = clients([], [{ id: 'foreign-client', full_name: 'Private' }]);
    expect(await listDashboardBookingClientIdentities({ ...c, bizId: 'own-biz', bookingIds: ['foreign'] })).toEqual([]);
    expect(c.admin.from).not.toHaveBeenCalled();
});

test('preserves historical snapshots and does not classify anonymous bookings via profile data', async () => {
    const c = clients([{ ...linked, client_name: 'Original Name' }, { ...linked, id: 'walk-in', client_id: null }], []);
    expect(await listDashboardBookingClientIdentities({ ...c, bizId: 'biz', bookingIds: ['booking-1','walk-in'] })).toEqual([]);
    expect(c.admin.from).not.toHaveBeenCalled();
});

test('deduplicates profile reads and returns only requested booking projections', async () => {
    const c = clients([linked, { ...linked, id: 'booking-2', client_name: ' ' }], [{ id: 'client-1', full_name: 'Known' }, {id:'other', full_name:'Not returned'}]);
    expect(await listDashboardBookingClientIdentities({ ...c, bizId: 'biz', bookingIds: ['booking-1','booking-2'] })).toEqual([{bookingId:'booking-1',name:'Known'}, {bookingId:'booking-2',name:'Known'}]);
    expect(c.profileQuery.in).toHaveBeenCalledWith('id', ['client-1']);
});

test.each([{profiles:[]}, {profiles:[{id:'client-1',full_name:null}]}, {profiles:[{id:'client-1',full_name:' '}]}])('ignores unavailable or blank profiles: %j', async ({profiles}) => {
    const c = clients([linked], profiles);
    expect(await listDashboardBookingClientIdentities({ ...c, bizId:'biz', bookingIds:['booking-1'] })).toEqual([]);
});

test('empty request skips all queries', async () => {
    const c = clients([], []);
    expect(await listDashboardBookingClientIdentities({ ...c, bizId:'biz', bookingIds:[] })).toEqual([]);
    expect(c.supabase.from).not.toHaveBeenCalled();
});

test('booking failure never falls through to privileged profiles', async () => {
    const c = clients([linked], [], {message:'denied'});
    await expect(listDashboardBookingClientIdentities({ ...c, bizId:'biz', bookingIds:['booking-1'] })).rejects.toThrow('Unable to read booking identities');
    expect(c.admin.from).not.toHaveBeenCalled();
});

test('profile error is explicit', async () => {
    const c = clients([linked], [], null, {message:'offline'});
    await expect(listDashboardBookingClientIdentities({ ...c, bizId:'biz', bookingIds:['booking-1'] })).rejects.toThrow('Unable to read client names');
});
