import { mapApplicationPolicyError } from '@/lib/applicationPolicy';

describe('application policy errors', () => {
    test.each([
        ['APPLICATION_POLICY:active_limit', 429, 'active_limit'],
        ['APPLICATION_POLICY:cooldown_7d', 429, 'cooldown_7d'],
        ['APPLICATION_POLICY:blocked', 403, 'blocked'],
        ['APPLICATION_POLICY:owner_cannot_be_staff', 409, 'owner_cannot_be_staff'],
    ])('maps %s to a safe API response', (message, status, code) => {
        expect(mapApplicationPolicyError({ code: 'P0001', message })).toMatchObject({
            ok: false,
            status,
            code,
        });
    });

    test('does not expose unrelated database failures as policy errors', () => {
        expect(mapApplicationPolicyError({ code: '42P01', message: 'relation missing' })).toBeNull();
    });
});
