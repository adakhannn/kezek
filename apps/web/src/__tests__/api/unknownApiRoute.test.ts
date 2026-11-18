import * as adminApi from '@/app/admin/api/[...path]/route';
import * as api from '@/app/api/[...path]/route';
import * as dashboardApi from '@/app/dashboard/api/[...path]/route';

// API-12: a POST to an unknown API path answered 200 with the HTML not-found page.
describe('unknown API paths', () => {
    const cases = [api, adminApi, dashboardApi].flatMap((module) =>
        (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((method) => [method, module[method]] as const));

    test.each(cases)('%s answers a JSON 404', async (_method, handler) => {
        const response = handler();

        expect(response.status).toBe(404);
        expect(response.headers.get('content-type')).toContain('application/json');
        expect(await response.json()).toEqual({ ok: false, error: 'not_found', message: 'Unknown API endpoint' });
    });
});
