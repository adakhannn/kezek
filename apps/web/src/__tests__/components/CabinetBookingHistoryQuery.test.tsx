/** @jest-environment node */
import { createServerClient } from '@supabase/ssr';

import BookingsPage from '@/app/cabinet/bookings/page';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn(async () => ({ get: jest.fn() })) }));
jest.mock('@/app/cabinet/ClientCabinet', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/cabinet/bookings/BookingsPageClient', () => ({ __esModule: true, default: () => null }));

test('keeps future cancellations in own history without loosening client scope', async () => {
    const scopes: Array<{ eq: jest.Mock; in: jest.Mock; neq: jest.Mock; gte: jest.Mock; lt: jest.Mock; or: jest.Mock; order: jest.Mock }> = [];
    const from = jest.fn(() => {
        const query = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), neq: jest.fn(), gte: jest.fn(), lt: jest.fn(), or: jest.fn(), order: jest.fn(async () => ({ data: [] })) };
        for (const method of [query.select, query.eq, query.in, query.neq, query.gte, query.lt, query.or]) method.mockReturnValue(query);
        scopes.push(query);
        return query;
    });
    jest.mocked(createServerClient).mockReturnValue({ auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'own-client' } } })) }, from } as unknown as ReturnType<typeof createServerClient>);
    await BookingsPage();
    expect(scopes).toHaveLength(2);
    for (const query of scopes) expect(query.eq).toHaveBeenCalledWith('client_id', 'own-client');
    expect(scopes[0].in).toHaveBeenCalledWith('status', ['hold', 'confirmed']);
    expect(scopes[0].gte).toHaveBeenCalledWith('end_at', expect.any(String));
    expect(scopes[1].or).toHaveBeenCalledWith(expect.stringMatching(/^end_at\.lt\..+,status\.in\.\(paid,cancelled,no_show\)$/));
    expect(scopes[1].lt).not.toHaveBeenCalled();
    expect(scopes[1].order).toHaveBeenCalledWith('start_at', { ascending: false });
});
