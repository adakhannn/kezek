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
    beforeEach(() => {
        jest.clearAllMocks();
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
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
});
