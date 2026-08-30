import { canModerateBusinessRegistrationApplication } from '@/lib/businessApplicationStatus';

describe('business application moderation status', () => {
    test.each(['new', 'contacted'])('allows actions for %s applications', (status) => {
        expect(canModerateBusinessRegistrationApplication(status)).toBe(true);
    });

    test.each(['approved', 'rejected', null, undefined, 'unknown'])(
        'hides actions for terminal or invalid status %s',
        (status) => {
            expect(canModerateBusinessRegistrationApplication(status)).toBe(false);
        },
    );
});
