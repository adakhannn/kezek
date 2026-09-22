import { buildApplicationTemplateComponents, getApplicationNotificationOrigin, getApplicationTemplateParameterNames } from '@/lib/applicationNotificationConfig';

describe('application notification configuration', () => {
    const originalEnv = process.env;
    beforeEach(() => { process.env = { ...originalEnv, NEXT_PUBLIC_SITE_ORIGIN: 'https://kezek.kg' }; delete process.env.WHATSAPP_APPLICATION_NAMED_PARAMETERS; delete process.env.YANDEX_OAUTH_PUBLIC_ORIGIN; delete process.env.LOCAL_AUTH_PUBLIC_ORIGIN; });
    afterEach(() => { process.env = originalEnv; });
    test('uses the public tunnel locally', () => {
        process.env = { ...process.env, NODE_ENV: 'development', LOCAL_AUTH_PUBLIC_ORIGIN: 'https://local-test.trycloudflare.com' };
        expect(getApplicationNotificationOrigin()).toBe('https://local-test.trycloudflare.com');
    });
    test('uses only the configured site origin in production', () => {
        process.env = { ...process.env, NODE_ENV: 'production', LOCAL_AUTH_PUBLIC_ORIGIN: 'https://local-test.trycloudflare.com' };
        expect(getApplicationNotificationOrigin()).toBe('https://kezek.kg');
    });
    test('preserves positional templates', () => {
        expect(buildApplicationTemplateComponents(['Business', 'Name'])).toEqual([{ type: 'body', parameters: [{ type: 'text', text: 'Business' }, { type: 'text', text: 'Name' }] }]);
    });
    test('maps explicit names without confusing business and applicant values', () => {
        process.env.WHATSAPP_APPLICATION_NAMED_PARAMETERS = JSON.stringify({ staff_owner: ['business', 'applicant'] });
        expect(buildApplicationTemplateComponents(['Business', 'Name'], getApplicationTemplateParameterNames('staff_owner'))).toEqual([{ type: 'body', parameters: [{ type: 'text', text: 'Business', parameter_name: 'business' }, { type: 'text', text: 'Name', parameter_name: 'applicant' }] }]);
        expect(getApplicationTemplateParameterNames('staff_approved')).toEqual([]);
    });
    test.each([['only_one'], ['same', 'same'], ['business', ''], ['business', 'invalid name']])('rejects mismatched names %j', (...names) => {
        expect(() => buildApplicationTemplateComponents(['Business', 'Name'], names)).toThrow();
    });
    test('rejects malformed configuration', () => {
        for (const raw of ['{', '[]', '{"staff_owner":"name"}']) {
            process.env.WHATSAPP_APPLICATION_NAMED_PARAMETERS = raw;
            expect(() => getApplicationTemplateParameterNames('staff_owner')).toThrow();
        }
    });
});
