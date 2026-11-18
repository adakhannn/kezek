jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn(), createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/adminAccess', () => ({ checkCurrentUserIsSuperAdmin: jest.fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));

import { GET, POST } from '@/app/admin/api/rating-config/route';
import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { logError } from '@/lib/log';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

/** A query builder whose every chained call returns itself and whose terminal calls resolve `result`. */
function query(result: { data: unknown; error: unknown }) {
    const builder: Record<string, jest.Mock> = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'update', 'insert']) builder[method] = jest.fn(() => builder);
    builder.maybeSingle = jest.fn().mockResolvedValue(result);
    builder.single = jest.fn().mockResolvedValue(result);
    builder.then = jest.fn((resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }));
    return builder;
}

function signedInSuperAdmin(from = jest.fn()) {
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'super-admin' } }, error: null }) },
        from,
    });
    (checkCurrentUserIsSuperAdmin as jest.Mock).mockResolvedValue({ isSuperAdmin: true, error: null });
}

const validWeights = { staff_reviews_weight: 35, staff_productivity_weight: 25, staff_loyalty_weight: 20, staff_discipline_weight: 20, window_days: 30 };
const post = () => POST(new Request('http://localhost/admin/api/rating-config', { method: 'POST', body: JSON.stringify(validWeights) }));

describe('rating-config 5xx answers log their cause once (ARCH-04)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('GET: a failed config read answers 500 and logs the database error', async () => {
        const configError = { message: 'relation "rating_global_config" does not exist' };
        signedInSuperAdmin(jest.fn(() => query({ data: null, error: configError })));

        const response = await GET();

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ ok: false, error: configError.message });
        expect(logError).toHaveBeenCalledTimes(1);
        expect(logError).toHaveBeenCalledWith('RatingConfig', 'Failed to load rating config', configError);
    });

    test('GET: an unexpected exception answers 500 and logs it', async () => {
        const failure = new Error('session store down');
        (createSupabaseServerClient as jest.Mock).mockRejectedValue(failure);

        const response = await GET();

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ ok: false, error: 'session store down' });
        expect(logError).toHaveBeenCalledTimes(1);
        expect(logError).toHaveBeenCalledWith('RatingConfig', 'Unexpected error loading rating config', failure);
    });

    test('POST: a failed insert answers 500 and logs the database error', async () => {
        const insertError = { message: 'new row violates check constraint' };
        signedInSuperAdmin();
        (createSupabaseAdminClient as jest.Mock).mockReturnValue({ from: jest.fn(() => query({ data: null, error: insertError })) });

        const response = await post();

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ ok: false, error: insertError.message });
        expect(logError).toHaveBeenCalledTimes(1);
        expect(logError).toHaveBeenCalledWith('RatingConfig', 'Failed to save rating config', insertError);
    });

    test('POST: an unexpected exception answers 500 and logs it', async () => {
        const failure = new Error('service role key missing');
        signedInSuperAdmin();
        (createSupabaseAdminClient as jest.Mock).mockImplementation(() => { throw failure; });

        const response = await post();

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ ok: false, error: 'service role key missing' });
        expect(logError).toHaveBeenCalledTimes(1);
        expect(logError).toHaveBeenCalledWith('RatingConfig', 'Unexpected error saving rating config', failure);
    });
});
