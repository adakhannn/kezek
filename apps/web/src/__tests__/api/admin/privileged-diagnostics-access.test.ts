jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/whatsAppDiagnoseRouteService', () => ({ runWhatsAppDiagnoseRoute: jest.fn() }));
jest.mock('@/lib/whatsAppAccountLookupService', () => ({ loadWhatsAppBusinessAccountData: jest.fn(), loadWhatsAppPhoneNumbers: jest.fn() }));
jest.mock('@/lib/whatsAppTestService', () => ({ getWhatsAppTestSnapshot: jest.fn() }));
jest.mock('@/lib/notifyPingService', () => ({ runNotifyPing: jest.fn() }));

import { GET as metrics } from '@/app/admin/api/metrics/route';
import { GET as metricsStats } from '@/app/admin/api/metrics/stats/route';
import { GET as authMetrics } from '@/app/admin/api/metrics/auth-flow/route';
import { GET as financeLogs } from '@/app/admin/api/finance-logs/route';
import { runWhatsAppDiagnoseHttp } from '@/lib/whatsAppDiagnoseHttpService';
import { runWhatsAppBusinessAccountLookupHttp, runWhatsAppPhoneNumbersLookupHttp } from '@/lib/whatsAppAccountLookupHttpService';
import { runWhatsAppTestHttp } from '@/lib/whatsAppTestHttpService';
import { runNotifyPingHttp } from '@/lib/notifyPingHttpService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';
import { runWhatsAppDiagnoseRoute } from '@/lib/whatsAppDiagnoseRouteService';
import { loadWhatsAppBusinessAccountData, loadWhatsAppPhoneNumbers } from '@/lib/whatsAppAccountLookupService';
import { getWhatsAppTestSnapshot } from '@/lib/whatsAppTestService';
import { runNotifyPing } from '@/lib/notifyPingService';

const endpoints = [
    ['metrics', metrics], ['metrics stats', metricsStats], ['auth metrics', authMetrics], ['finance logs', financeLogs],
    ['WhatsApp diagnose', runWhatsAppDiagnoseHttp], ['WhatsApp account', runWhatsAppBusinessAccountLookupHttp],
    ['WhatsApp phones', runWhatsAppPhoneNumbersLookupHttp], ['WhatsApp config', () => runWhatsAppTestHttp({})],
    ['notify ping', runNotifyPingHttp],
] as const;

describe.each(endpoints)('%s access boundary', (_name, handler) => {
    const rpc = jest.fn();
    const getUser = jest.fn();
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser }, rpc } as never);
    });
    test.each([401, 403, 503])('rejects with %i before any privileged/provider work', async status => {
        getUser.mockResolvedValue({ data: { user: status === 401 ? null : { id: 'ordinary-user' } }, error: null });
        rpc.mockResolvedValue({ data: false, error: status === 503 ? { message: 'unavailable' } : null });
        const response = await handler(new Request('http://localhost/diagnostic', { method: 'POST', body: 'invalid JSON' }));
        expect(response.status).toBe(status);
        if (status !== 401) expect(rpc).toHaveBeenCalledWith('is_super_admin');
        else expect(rpc).not.toHaveBeenCalled();
        for (const sideEffect of [getServiceClient, runWhatsAppDiagnoseRoute, loadWhatsAppBusinessAccountData, loadWhatsAppPhoneNumbers, getWhatsAppTestSnapshot, runNotifyPing]) {
            expect(sideEffect).not.toHaveBeenCalled();
        }
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
