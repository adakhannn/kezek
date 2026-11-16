const send = jest.fn();

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

        await expect(sendAlertEmail([alert])).resolves.toEqual({
            success: false,
            error: 'ALERT_EMAIL_TO or EMAIL_FROM not configured',
        });
        expect(send).not.toHaveBeenCalled();
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
