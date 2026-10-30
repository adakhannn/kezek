jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn(() => ({ private: true })) }));
jest.mock('@/lib/dashboardBookingClientIdentityService', () => ({ listDashboardBookingClientIdentities: jest.fn() }));

import { getBizContextForManagers } from '@/lib/authBiz';
import { runDashboardBookingClientIdentityHttp } from '@/lib/dashboardBookingClientIdentityHttpService';
import { listDashboardBookingClientIdentities } from '@/lib/dashboardBookingClientIdentityService';
import { getServiceClient } from '@/lib/supabaseService';

const id = '03469725-c5ba-4978-abfe-2179f19caeab';
const request = (body: unknown) => new Request('http://localhost/api/bookings/client-identities', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getBizContextForManagers).mockResolvedValue({supabase:{},bizId:'current-biz'} as never); jest.mocked(listDashboardBookingClientIdentities).mockResolvedValue([{bookingId:id,name:'Client'}]); });

test('auth failure prevents privileged access and projection lookup', async () => {
    jest.mocked(getBizContextForManagers).mockRejectedValue(new Error('forbidden'));
    await expect(runDashboardBookingClientIdentityHttp(request({bookingIds:[id]}))).rejects.toThrow('forbidden');
    expect(getServiceClient).not.toHaveBeenCalled();
    expect(listDashboardBookingClientIdentities).not.toHaveBeenCalled();
});

test.each([{bookingIds:['bad']}, {bookingIds:Array(31).fill(id)}, {bookingIds:[id],bizId:'foreign'}, {clientIds:[id]}, {}])('rejects invalid or caller-selected authorization input %j', async body => {
    expect((await runDashboardBookingClientIdentityHttp(request(body))).status).toBe(400);
    expect(listDashboardBookingClientIdentities).not.toHaveBeenCalled();
    expect(getServiceClient).not.toHaveBeenCalled();
});

test('derives business from authenticated context, returns only minimal identities', async () => {
    const response = await runDashboardBookingClientIdentityHttp(request({bookingIds:[id]}));
    expect(listDashboardBookingClientIdentities).toHaveBeenCalledWith({supabase:{},admin:{private:true},bizId:'current-biz',bookingIds:[id]});
    expect(await response.json()).toMatchObject({ok:true,identities:[{bookingId:id,name:'Client'}]});
});
