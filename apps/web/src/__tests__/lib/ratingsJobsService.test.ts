import { getRatingsJobs } from '@/lib/ratingsJobsService';

describe('ratingsJobsService', () => {
    test('returns jobs list payload', async () => {
        const limit = jest.fn().mockResolvedValue({
            data: [{ id: 'job-1', status: 'done' }],
            error: null,
        });
        const order = jest.fn().mockReturnValue({ limit });
        const select = jest.fn().mockReturnValue({ order });

        const result = await getRatingsJobs({
            admin: { from: jest.fn().mockReturnValue({ select }) } as never,
        });

        expect(result).toEqual({
            ok: true,
            data: {
                jobs: [{ id: 'job-1', status: 'done' }],
            },
        });
    });

    test('returns internal error when query fails', async () => {
        const limit = jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'db failed' },
        });
        const order = jest.fn().mockReturnValue({ limit });
        const select = jest.fn().mockReturnValue({ order });

        const result = await getRatingsJobs({
            admin: { from: jest.fn().mockReturnValue({ select }) } as never,
        });

        expect(result).toEqual({
            ok: false,
            error: 'internal',
            message: 'db failed',
            status: 500,
        });
    });
});
