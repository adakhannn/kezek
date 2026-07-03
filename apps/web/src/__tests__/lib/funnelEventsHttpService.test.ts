jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/funnelEventsService', () => ({
    funnelEventSchema: { parse: jest.fn() },
    saveFunnelEvent: jest.fn(),
}));

jest.mock('@/lib/validation/apiValidation', () => ({
    validateBody: jest.fn(),
}));

import { runFunnelEventsHttp } from '@/lib/funnelEventsHttpService';
import { saveFunnelEvent } from '@/lib/funnelEventsService';
import { getServiceClient } from '@/lib/supabaseService';
import { validateBody } from '@/lib/validation/apiValidation';

describe('funnelEventsHttpService', () => {
    const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    });

    afterAll(() => {
        if (originalServiceRoleKey === undefined) {
            delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        } else {
            process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
        }
    });

    test('delegates validated event to funnel service', async () => {
        (validateBody as jest.Mock).mockResolvedValue({
            success: true,
            data: { event_type: 'slot_select', biz_id: 'biz-id' },
        });
        (saveFunnelEvent as jest.Mock).mockResolvedValue({ ok: true });

        const response = await runFunnelEventsHttp(
            new Request('http://localhost/api/funnel-events', { method: 'POST', body: '{}' }),
        );
        const body = await response.json();

        expect(saveFunnelEvent).toHaveBeenCalledWith(expect.any(Object), {
            event_type: 'slot_select',
            biz_id: 'biz-id',
        });
        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
    });

    test('safely skips tracking when service role key is not configured', async () => {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        (validateBody as jest.Mock).mockResolvedValue({
            success: true,
            data: { event_type: 'business_view', biz_id: 'biz-id' },
        });

        const response = await runFunnelEventsHttp(
            new Request('http://localhost/api/funnel-events', { method: 'POST', body: '{}' }),
        );
        const body = await response.json();

        expect(getServiceClient).not.toHaveBeenCalled();
        expect(saveFunnelEvent).not.toHaveBeenCalled();
        expect(response.status).toBe(200);
        expect(body).toEqual({ ok: true, data: { skipped: true } });
    });
});
