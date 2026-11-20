jest.mock('@/app/dashboard/staff/[id]/StaffDetailPageClient', () => ({ __esModule:true, default:jest.fn() }));
jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers:jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient:jest.fn() }));
jest.mock('@/lib/staffPrivateFields', () => ({ readStaffPrivateFields:jest.fn() }));
jest.mock('@/lib/scheduling/config', () => ({ explicitSchedulingEnabled:() => true }));
jest.mock('next/navigation', () => ({ notFound:jest.fn(() => { throw new Error('not-found'); }) }));

import Page from '@/app/dashboard/staff/[id]/page';
import { getBizContextForManagers } from '@/lib/authBiz';
import { readStaffPrivateFields } from '@/lib/staffPrivateFields';
import { getServiceClient } from '@/lib/supabaseService';

const review = { id:'review', rating:3, comment:'LIVE TEST REVIEW', created_at:'2026-10-13T00:00:00Z' };
let reviews: typeof review | typeof review[] | null;
let staffBiz: string;

function query(data: unknown) {
    const result = { data, error:null };
    return {
        select:jest.fn().mockReturnThis(), eq:jest.fn().mockReturnThis(), order:jest.fn().mockReturnThis(),
        limit:jest.fn().mockReturnThis(), maybeSingle:jest.fn().mockResolvedValue(result),
        then:(resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    reviews = review;
    staffBiz = 'business';
    const client = { from:jest.fn((table: string) => {
        if (table === 'branches') return query([]);
        return query(null);
    }) };
    // Contacts and pay terms come through staff_private_fields(), never a plain staff select.
    jest.mocked(readStaffPrivateFields).mockImplementation(async () => ({
        data:{ id:'11111111-1111-4111-8111-111111111111', biz_id:staffBiz, full_name:'Test', branch_id:'branch', is_active:true },
        error:null,
    }) as never);
    jest.mocked(getBizContextForManagers).mockResolvedValue({ supabase:client, bizId:'business' } as unknown as Awaited<ReturnType<typeof getBizContextForManagers>>);
    jest.mocked(getServiceClient).mockReturnValue({ from:jest.fn(() => query([{
        id:'booking', start_at:'2026-10-12T11:00:00Z', end_at:'2026-10-12T12:00:00Z',
        client_name:null, client_phone:null, service_id:'service', services:{name_ru:'Service'}, reviews,
    }])) } as unknown as ReturnType<typeof getServiceClient>);
});

test('renders a unique review relation returned as an object without crashing', async () => {
    const page = await Page({ params:Promise.resolve({ id:'11111111-1111-4111-8111-111111111111' }) });
    expect(page.props.reviews).toEqual([expect.objectContaining({ id:'review', rating:3, booking_id:'booking', service_name:'Service' })]);
});

test('preserves legacy array relations and newest-first review order', async () => {
    reviews = [{...review, id:'older', created_at:'2026-10-12T00:00:00Z'}, review];
    const page = await Page({ params:Promise.resolve({ id:'11111111-1111-4111-8111-111111111111' }) });
    expect(page.props.reviews.map((item: {id:string}) => item.id)).toEqual(['review', 'older']);
});

test('reads the staff card through the private fields function with the manager session', async () => {
    await Page({ params:Promise.resolve({ id:'11111111-1111-4111-8111-111111111111' }) });
    const { supabase } = await jest.mocked(getBizContextForManagers).mock.results[0].value;
    expect(readStaffPrivateFields).toHaveBeenCalledWith(supabase, '11111111-1111-4111-8111-111111111111');
});

test('answers not found when the function refuses a staff member of another business', async () => {
    jest.mocked(readStaffPrivateFields).mockResolvedValue({ data:null, error:{ code:'42501', message:'STAFF_FORBIDDEN' } });
    await expect(Page({ params:Promise.resolve({ id:'11111111-1111-4111-8111-111111111111' }) })).rejects.toThrow('not-found');
    expect(getServiceClient).not.toHaveBeenCalled();
});

test('does not load privileged reviews for a staff member in a different business', async () => {
    staffBiz = 'another-business';
    await expect(Page({ params:Promise.resolve({ id:'11111111-1111-4111-8111-111111111111' }) })).rejects.toThrow('not-found');
    expect(getServiceClient).not.toHaveBeenCalled();
});

test('a staff id that is not a UUID is a 404 before any read (no database error text on the page)', async () => {
    await expect(Page({ params:Promise.resolve({ id:'finance' }) })).rejects.toThrow('not-found');
    expect(readStaffPrivateFields).not.toHaveBeenCalled();
});
