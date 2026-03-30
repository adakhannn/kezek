import { GET } from '@/app/api/dashboard/integrations-status/route';

import { expectSuccessResponse } from '../testHelpers';

jest.mock('@/lib/integrationsStatusHttpService', () => ({
    runIntegrationsStatusHttp: jest.fn(),
}));

const { runIntegrationsStatusHttp } = require('@/lib/integrationsStatusHttpService');

describe('/api/dashboard/integrations-status', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates GET to integrations status http service', async () => {
        runIntegrationsStatusHttp.mockResolvedValue(
            Response.json({
                ok: true,
                data: {
                    whatsapp: { configured: true, ok: true },
                    telegram: { configured: false, ok: false },
                },
            }),
        );

        const res = await GET(new Request('http://localhost/api/dashboard/integrations-status'));
        const data = await expectSuccessResponse(res);

        expect(data.data.whatsapp.ok).toBe(true);
    });
});
