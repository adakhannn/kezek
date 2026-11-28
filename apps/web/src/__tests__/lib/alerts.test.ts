const send = jest.fn();

jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));

jest.mock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({ emails: { send } })),
}));

describe('sendAlertEmail', () => {
    const originalEnv = process.env;
    const alert = { type: 'error' as const, message: 'Synthetic failure' };

    beforeEach(() => {
        jest.resetModules();
        send.mockReset();
        process.env = { ...originalEnv, RESEND_API_KEY: 'synthetic-key', EMAIL_FROM: 'Kezek <alerts@example.test>' };
        delete process.env.ALERT_EMAIL_TO;
        delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('does not fall back to a guessed inbox when ALERT_EMAIL_TO is missing', async () => {
        const { sendAlertEmail } = await import('@/lib/alerts');
        const log = await import('@/lib/log');

        await expect(sendAlertEmail([alert])).resolves.toEqual({
            success: false,
            error: 'ALERT_EMAIL_TO or EMAIL_FROM not configured',
            notConfigured: true,
        });
        expect(send).not.toHaveBeenCalled();
        // A configuration gap is one warning per call, not an error-level Sentry issue (KEZEK-WEB-2/3/6).
        expect(log.logWarn).toHaveBeenCalledTimes(1);
        expect(log.logWarn).toHaveBeenCalledWith('Alerts', 'ALERT_EMAIL_TO or EMAIL_FROM not configured, skipping email alert');
        expect(log.logError).not.toHaveBeenCalled();
    });

    it('reports a missing Resend key as a warning, not an error', async () => {
        delete process.env.RESEND_API_KEY;
        const { sendAlertEmail } = await import('@/lib/alerts');
        const log = await import('@/lib/log');

        await expect(sendAlertEmail([alert])).resolves.toMatchObject({ success: false, notConfigured: true });
        expect(log.logWarn).toHaveBeenCalledTimes(1);
        expect(log.logError).not.toHaveBeenCalled();
    });

    it('a Resend failure stays an error and is not marked as missing configuration', async () => {
        process.env.ALERT_EMAIL_TO = 'ops@example.test';
        send.mockResolvedValue({ data: null, error: { message: 'domain not verified' } });
        const { sendAlertEmail } = await import('@/lib/alerts');
        const log = await import('@/lib/log');

        await expect(sendAlertEmail([alert])).resolves.toEqual({ success: false, error: 'domain not verified' });
        expect(log.logError).toHaveBeenCalledWith('Alerts', 'Failed to send email alert', expect.anything());
    });

    it('does not invent a sender when EMAIL_FROM is missing', async () => {
        process.env.ALERT_EMAIL_TO = 'ops@example.test';
        delete process.env.EMAIL_FROM;
        const { sendAlertEmail } = await import('@/lib/alerts');

        await expect(sendAlertEmail([alert])).resolves.toMatchObject({ success: false });
        expect(send).not.toHaveBeenCalled();
    });

    it('sends to the configured inbox with a health-check link on the configured origin', async () => {
        process.env.ALERT_EMAIL_TO = 'ops@example.test';
        send.mockResolvedValue({ data: { id: 'email-1' }, error: null });
        const { sendAlertEmail } = await import('@/lib/alerts');

        await expect(sendAlertEmail([alert])).resolves.toEqual({ success: true });
        expect(send).toHaveBeenCalledWith(expect.objectContaining({
            from: 'Kezek <alerts@example.test>',
            to: 'ops@example.test',
            html: expect.stringContaining('https://kezek.vercel.app/admin/health-check'),
        }));
        expect(JSON.stringify(send.mock.calls)).not.toContain('kezek.kg');
    });
});
