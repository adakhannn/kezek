jest.mock('@/lib/integrationsStatusService', () => ({
    getIntegrationsStatus: jest.fn(),
}));

jest.mock('@/lib/withManagerContext', () => ({
    withManagerContext: jest.fn(),
}));

import { getIntegrationsStatus } from '@/lib/integrationsStatusService';
import { withManagerContext } from '@/lib/withManagerContext';

describe('integrationsStatusHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (withManagerContext as jest.Mock).mockImplementation(async (_req, _scope, handler) => handler());
    });

    test('delegates to integrations status service under manager context', async () => {
        (getIntegrationsStatus as jest.Mock).mockResolvedValue({
            whatsapp: { configured: true, ok: true },
            telegram: { configured: false, ok: false },
        });
        const { runIntegrationsStatusHttp } = await import('@/lib/integrationsStatusHttpService');

        const response = await runIntegrationsStatusHttp(
            new Request('http://localhost/api/dashboard/integrations-status'),
        );
        const body = await response.json();

        expect(withManagerContext).toHaveBeenCalledWith(
            expect.any(Request),
            'IntegrationsStatus',
            expect.any(Function),
        );
        expect(response.status).toBe(200);
        expect(body.data.whatsapp.ok).toBe(true);
    });
});
