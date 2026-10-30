jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/usersSearchService', () => ({
    runUsersSearch: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { runUsersSearch } from '@/lib/usersSearchService';

describe('usersSearchHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: { from: jest.fn() },
            bizId: 'biz-1',
        });
    });

    test('returns validation error for invalid payload', async () => {
        const { runUsersSearchHttp } = await import('@/lib/usersSearchHttpService');

        const response = await runUsersSearchHttp(
            new Request('http://localhost/api/users/search', {
                method: 'POST',
                body: JSON.stringify({ page: 'bad' }),
                headers: { 'content-type': 'application/json' },
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('validation');
    });

    test('delegates to users search service for valid payload', async () => {
        (runUsersSearch as jest.Mock).mockResolvedValue({
            items: [{ id: 'user-1' }],
            page: 1,
            perPage: 50,
        });
        const { runUsersSearchHttp } = await import('@/lib/usersSearchHttpService');

        const response = await runUsersSearchHttp(
            new Request('http://localhost/api/users/search', {
                method: 'POST',
                body: JSON.stringify({ q: 'known@example.test', page: 1, perPage: 50 }),
                headers: { 'content-type': 'application/json' },
            }),
        );
        const body = await response.json();

        expect(runUsersSearch).toHaveBeenCalledWith({
            supabase: expect.any(Object),
            bizId: 'biz-1',
            input: expect.objectContaining({ page: 1, perPage: 50 }),
        });
        expect(response.status).toBe(200);
        expect(body.page).toBe(1);
    });

    test.each([{}, {q:''}, {q:'  '}, {q:'\t\n'}])('rejects a missing/blank query before privileged search %j', async (payload) => {
        const { runUsersSearchHttp } = await import('@/lib/usersSearchHttpService');
        const response = await runUsersSearchHttp(new Request('http://localhost/api/users/search', {
            method: 'POST', headers: {'content-type':'application/json'}, body:JSON.stringify(payload),
        }));
        expect(response.status).toBe(400);
        expect(runUsersSearch).not.toHaveBeenCalled();
    });
});
