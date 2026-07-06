type ServiceClientLike = {
    rpc: (fn: string, params: Record<string, unknown>) => Promise<{
        data?: unknown;
        error?: { message?: string } | null;
    }>;
};

const RETENTION = {
    apiMetricsDays: 90,
    financeLogsDays: 365,
    funnelEventsDays: 400,
    bookingsPiiOlderThanDays: 2555,
    profilesInactiveDays: 1095,
    telegramMobileAttemptsKeepMinutes: 1440,
} as const;

export async function runDataRetention({
    supabase,
}: {
    supabase: ServiceClientLike;
}): Promise<
    | { ok: true; data: Record<string, number | string> & { message: string } }
    | { ok: false; error: 'internal'; message: string; status: 500 }
> {
    const result: Record<string, number | string> = {};

    try {
        const { data: apiDeleted, error: e1 } = await supabase.rpc('cleanup_old_api_metrics', {
            p_keep_days: RETENTION.apiMetricsDays,
        });
        if (e1) {
            result.api_metrics_error = e1.message ?? 'cleanup_old_api_metrics failed';
        } else {
            result.api_metrics_deleted = typeof apiDeleted === 'number' ? apiDeleted : 0;
        }

        const { data: financeDeleted, error: e2 } = await supabase.rpc('cleanup_old_finance_logs', {
            p_keep_days: RETENTION.financeLogsDays,
        });
        if (e2) {
            result.finance_logs_error = e2.message ?? 'cleanup_old_finance_logs failed';
        } else {
            result.finance_logs_deleted = typeof financeDeleted === 'number' ? financeDeleted : 0;
        }

        const { data: funnelDeleted, error: e3 } = await supabase.rpc('cleanup_old_funnel_events', {
            p_keep_days: RETENTION.funnelEventsDays,
        });
        if (e3) {
            result.funnel_events_error = e3.message ?? 'cleanup_old_funnel_events failed';
        } else {
            result.funnel_events_deleted = typeof funnelDeleted === 'number' ? funnelDeleted : 0;
        }

        const { data: bookingsAnonymized, error: e4 } = await supabase.rpc('anonymize_old_bookings_pii', {
            p_older_than_days: RETENTION.bookingsPiiOlderThanDays,
        });
        if (e4) {
            result.bookings_pii_error = e4.message ?? 'anonymize_old_bookings_pii failed';
        } else {
            result.bookings_pii_anonymized = typeof bookingsAnonymized === 'number' ? bookingsAnonymized : 0;
        }

        const { data: profilesAnonymized, error: e5 } = await supabase.rpc('anonymize_inactive_profiles_pii', {
            p_inactive_days: RETENTION.profilesInactiveDays,
        });
        if (e5) {
            result.profiles_pii_error = e5.message ?? 'anonymize_inactive_profiles_pii failed';
        } else {
            result.profiles_pii_anonymized = typeof profilesAnonymized === 'number' ? profilesAnonymized : 0;
        }

        const { data: telegramAttemptsDeleted, error: e6 } = await supabase.rpc(
            'cleanup_expired_telegram_mobile_auth_attempts',
            {
                p_keep_minutes: RETENTION.telegramMobileAttemptsKeepMinutes,
            },
        );
        if (e6) {
            result.telegram_mobile_attempts_error =
                e6.message ?? 'cleanup_expired_telegram_mobile_auth_attempts failed';
        } else {
            result.telegram_mobile_attempts_deleted =
                typeof telegramAttemptsDeleted === 'number' ? telegramAttemptsDeleted : 0;
        }

        const { data: accountsDeleted, error: e7 } = await supabase.rpc(
            'finalize_due_account_deletions',
            { batch_limit: 50 },
        );
        if (e7) {
            result.account_deletions_error = e7.message ?? 'finalize_due_account_deletions failed';
        } else {
            result.accounts_deleted = typeof accountsDeleted === 'number' ? accountsDeleted : 0;
        }
    } catch (error) {
        return {
            ok: false,
            error: 'internal',
            message: error instanceof Error ? error.message : 'Data retention cron failed',
            status: 500,
        };
    }

    return {
        ok: true,
        data: {
            message: 'Data retention run completed',
            ...result,
        },
    };
}
