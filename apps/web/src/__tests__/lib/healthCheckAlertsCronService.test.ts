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
                if (table === 'analytics_events') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                gte: jest.fn().mockReturnValue({
                                    lt: jest.fn().mockResolvedValue({
                                        count: 0,
                                        data: null,
                                    }),
                                }),
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
                if (table === 'analytics_events') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                gte: jest.fn().mockReturnValue({
                                    lt: jest.fn().mockResolvedValue({
                                        count: 0,
                                        data: null,
                                    }),
                                }),
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

    test('adds telegram auth alerts when failed/expired grows and approved rate drops', async () => {
        const sendAlertEmail = jest.fn().mockResolvedValue({ success: true });

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
                if (
                    table === 'staff_day_metrics' ||
                    table === 'branch_day_metrics' ||
                    table === 'biz_day_metrics'
                ) {
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
                                        data: { created_at: '2026-03-26T00:00:00.000Z' },
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
                if (table === 'analytics_events') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn((column: string, value: string) => {
                                expect(column).toBe('event_type');

                                return {
                                    gte: jest.fn((createdColumn: string, fromIso: string) => {
                                        expect(createdColumn).toBe('created_at');

                                        return {
                                            lt: jest.fn(
                                                async (_toColumn: string, toIso: string) => {
                                                    const boundary =
                                                        '2026-03-26T12:00:00.000Z';
                                                    const isCurrentWindow =
                                                        fromIso >= boundary && toIso > boundary;

                                                    const currentCounts: Record<string, number> = {
                                                        telegram_mobile_login_failed: 12,
                                                        telegram_mobile_login_expired: 8,
                                                        telegram_mobile_login_approved: 10,
                                                    };
                                                    const previousCounts: Record<
                                                        string,
                                                        number
                                                    > = {
                                                        telegram_mobile_login_failed: 3,
                                                        telegram_mobile_login_expired: 2,
                                                        telegram_mobile_login_approved: 30,
                                                    };

                                                    return {
                                                        count: isCurrentWindow
                                                            ? currentCounts[value] ?? 0
                                                            : previousCounts[value] ?? 0,
                                                        data: null,
                                                    };
                                                },
                                            ),
                                        };
                                    }),
                                };
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

        const alerts = result.data.healthCheck.alerts;
        const messages = alerts.map((item) => item.message);
        expect(
            messages.some((message) =>
                message.includes('Рост telegram mobile login ошибок'),
            ),
        ).toBe(true);
        expect(
            messages.some((message) =>
                message.includes('Падение telegram mobile login approved rate'),
            ),
        ).toBe(true);

        expect(result.data.healthCheck.checks).toHaveProperty('telegramMobileAuth');
        expect(result.data.healthCheck.checks).toHaveProperty('googleMobileAuth');
        expect(sendAlertEmail).toHaveBeenCalled();
    });

    test('adds google auth alerts when failures grow and success rate drops', async () => {
        const sendAlertEmail = jest.fn().mockResolvedValue({ success: true });

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
                if (
                    table === 'staff_day_metrics' ||
                    table === 'branch_day_metrics' ||
                    table === 'biz_day_metrics'
                ) {
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
                                        data: { created_at: '2026-03-26T00:00:00.000Z' },
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
                if (table === 'analytics_events') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn((column: string, value: string) => {
                                expect(column).toBe('event_type');

                                return {
                                    gte: jest.fn((createdColumn: string, fromIso: string) => {
                                        expect(createdColumn).toBe('created_at');

                                        return {
                                            lt: jest.fn(
                                                async (_toColumn: string, toIso: string) => {
                                                    const boundary =
                                                        '2026-03-26T12:00:00.000Z';
                                                    const isCurrentWindow =
                                                        fromIso >= boundary && toIso > boundary;

                                                    const currentCounts: Record<string, number> = {
                                                        mobile_google_login_failed: 14,
                                                        mobile_google_login_success: 9,
                                                    };
                                                    const previousCounts: Record<
                                                        string,
                                                        number
                                                    > = {
                                                        mobile_google_login_failed: 4,
                                                        mobile_google_login_success: 40,
                                                    };

                                                    return {
                                                        count: isCurrentWindow
                                                            ? currentCounts[value] ?? 0
                                                            : previousCounts[value] ?? 0,
                                                        data: null,
                                                    };
                                                },
                                            ),
                                        };
                                    }),
                                };
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

        const alerts = result.data.healthCheck.alerts;
        const messages = alerts.map((item) => item.message);
        expect(
            messages.some((message) =>
                message.includes('mobile Google login failures'),
            ),
        ).toBe(true);
        expect(
            messages.some((message) =>
                message.includes('mobile Google login success rate'),
            ),
        ).toBe(true);

        expect(result.data.healthCheck.checks).toHaveProperty('googleMobileAuth');
        expect(sendAlertEmail).toHaveBeenCalled();
    });
});
