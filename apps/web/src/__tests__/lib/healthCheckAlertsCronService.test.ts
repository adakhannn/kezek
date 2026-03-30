import { runHealthCheckAlerts } from '@/lib/healthCheckAlertsCronService';

describe('healthCheckAlertsCronService', () => {
    test('returns healthy payload when no issues are found', async () => {
        const admin = {
            from: jest.fn((table: string) => {
                if (table === 'staff_shifts') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                lt: jest.fn().mockResolvedValue({ data: [] }),
                            }),
                        }),
                    };
                }
                if (table === 'staff_day_metrics' || table === 'branch_day_metrics' || table === 'biz_day_metrics') {
                    return {
                        select: jest.fn().mockReturnValue({
                            order: jest.fn().mockReturnValue({
                                limit: jest.fn().mockReturnValue({
                                    maybeSingle: jest.fn().mockResolvedValue({
                                        data: { metric_date: '2026-03-26T00:00:00.000Z' },
                                    }),
                                }),
                            }),
                        }),
                    };
                }
                if (table === 'client_promotion_usage') {
                    return {
                        select: jest.fn().mockReturnValue({
                            order: jest.fn().mockReturnValue({
                                limit: jest.fn().mockReturnValue({
                                    maybeSingle: jest.fn().mockResolvedValue({
                                        data: { created_at: '2026-03-25T00:00:00.000Z' },
                                    }),
                                }),
                            }),
                        }),
                    };
                }
                if (table === 'branch_promotions') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [],
                            }),
                        }),
                    };
                }
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        const result = await runHealthCheckAlerts({
            admin: admin as never,
            formatDate: (_date, _tz, _format) => '2026-03-27',
            tz: 'Asia/Almaty',
            now: new Date('2026-03-27T12:00:00.000Z'),
            sendAlertEmail: jest.fn().mockResolvedValue({ success: true }),
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data.healthCheck.ok).toBe(true);
        expect(result.data.alertSent).toBe(false);
    });

    test('sends alert email when issues are found', async () => {
        const sendAlertEmail = jest.fn().mockResolvedValue({ success: true });
        const admin = {
            from: jest.fn((table: string) => {
                if (table === 'staff_shifts') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                lt: jest.fn().mockResolvedValue({ data: [{ id: 'shift-1' }] }),
                            }),
                        }),
                    };
                }
                if (table === 'staff_day_metrics' || table === 'branch_day_metrics' || table === 'biz_day_metrics') {
                    return {
                        select: jest.fn().mockReturnValue({
                            order: jest.fn().mockReturnValue({
                                limit: jest.fn().mockReturnValue({
                                    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
                                }),
                            }),
                        }),
                    };
                }
                if (table === 'client_promotion_usage') {
                    return {
                        select: jest.fn().mockReturnValue({
                            order: jest.fn().mockReturnValue({
                                limit: jest.fn().mockReturnValue({
                                    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
                                }),
                            }),
                        }),
                    };
                }
                if (table === 'branch_promotions') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [{ id: 'promo-1' }],
                            }),
                        }),
                    };
                }
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        const result = await runHealthCheckAlerts({
            admin: admin as never,
            formatDate: (_date, _tz, _format) => '2026-03-27',
            tz: 'Asia/Almaty',
            now: new Date('2026-03-27T12:00:00.000Z'),
            sendAlertEmail,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data.healthCheck.ok).toBe(false);
        expect(result.data.alertSent).toBe(true);
        expect(sendAlertEmail).toHaveBeenCalled();
    });
});
