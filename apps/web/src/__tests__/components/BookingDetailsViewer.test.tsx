import type { ComponentProps, ReactElement } from 'react';

import type BookingLayoutClient from '@/app/booking/[id]/BookingLayoutClient';
import BookingPage from '@/app/booking/[id]/page';

const maybeSingle = jest.fn();
const getUser = jest.fn();
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: async () => ({
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
        auth: { getUser },
        rpc: jest.fn(),
    }),
}));
jest.mock('@/app/booking/[id]/BookingLayoutClient', () => ({ __esModule: true, default: () => null }));

const row = {
    id: 'b-1',
    status: 'confirmed',
    start_at: '2026-11-27T04:00:00Z',
    end_at: '2026-11-27T05:00:00Z',
    promotion_applied: null,
    subscription_applied: { plan_id: 'p-1' },
    client_id: 'client-1',
    services: { name_ru: 'Стрижка', name_ky: null, name_en: null },
    staff: { full_name: 'Айгуль' },
    biz: { tz: 'Asia/Bishkek' },
    branch: [{ name: 'Филиал Центр', address: 'ул. Ленина, 1' }],
    booking_services: [],
};

async function pageProps(): Promise<ComponentProps<typeof BookingLayoutClient>> {
    const element = (await BookingPage({ params: Promise.resolve({ id: 'b-1' }) })) as ReactElement<ComponentProps<typeof BookingLayoutClient>>;
    return element.props;
}

beforeEach(() => {
    maybeSingle.mockResolvedValue({ data: row, error: null });
});

test('the booking client gets the client view with the end, branch and package', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'client-1' } } });
    const props = await pageProps();
    expect(props.viewer).toBe('client');
    expect(props.endAt?.toISOString()).toBe('2026-11-27T05:00:00.000Z');
    expect(props.branch).toEqual({ name: 'Филиал Центр', address: 'ул. Ленина, 1' });
    expect(props.subscriptionApplied).toEqual({ plan_id: 'p-1' });
});

test('anyone else who reads it through RLS (a master, a manager) gets the staff view', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'staff-user' } } });
    expect((await pageProps()).viewer).toBe('staff');
});
