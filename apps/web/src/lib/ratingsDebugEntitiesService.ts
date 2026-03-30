type AuthClientLike = {
    from: (table: string) => any;
};

type AdminClientLike = {
    from: (table: string) => any;
};

export async function ensureSuperAdminAccess({
    supabase,
}: {
    supabase: AuthClientLike;
}): Promise<
    | { ok: true }
    | { ok: false; error: 'internal' | 'forbidden'; message: string; status: 400 | 403 }
> {
    const { data: superRow, error: superErr } = await supabase
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (superErr) {
        return {
            ok: false,
            error: 'internal',
            message: superErr.message,
            status: 400,
        };
    }

    if (!superRow) {
        return {
            ok: false,
            error: 'forbidden',
            message: 'Доступ запрещен',
            status: 403,
        };
    }

    return { ok: true };
}

export async function getRatingsDebugEntities({
    admin,
    days,
    windowStartStr,
}: {
    admin: AdminClientLike;
    days: number;
    windowStartStr: string;
}): Promise<{ ok: true; data: unknown }> {
    const [
        { data: staffNull },
        { data: branchesNull },
        { data: businessesNull },
    ] = await Promise.all([
        admin
            .from('staff')
            .select('id, full_name, biz_id, branch_id, last_rating_recalculated_at')
            .is('rating_score', null)
            .order('full_name'),
        admin
            .from('branches')
            .select('id, name, biz_id, last_rating_recalculated_at')
            .is('rating_score', null)
            .order('name'),
        admin
            .from('businesses')
            .select('id, name, slug, last_rating_recalculated_at')
            .is('rating_score', null)
            .order('name'),
    ]);

    const [
        { data: activeStaff },
        { data: staffWithMetrics },
        { data: activeBranches },
        { data: branchesWithMetrics },
        { data: approvedBiz },
        { data: bizWithMetrics },
    ] = await Promise.all([
        admin.from('staff').select('id').eq('is_active', true),
        admin.from('staff_day_metrics').select('staff_id').gte('metric_date', windowStartStr),
        admin.from('branches').select('id').eq('is_active', true),
        admin.from('branch_day_metrics').select('branch_id').gte('metric_date', windowStartStr),
        admin.from('businesses').select('id').eq('is_approved', true),
        admin.from('biz_day_metrics').select('biz_id').gte('metric_date', windowStartStr),
    ]);

    const staffIdsWithMetrics = new Set((staffWithMetrics ?? []).map((row: { staff_id: string }) => row.staff_id));
    const branchIdsWithMetrics = new Set((branchesWithMetrics ?? []).map((row: { branch_id: string }) => row.branch_id));
    const bizIdsWithMetrics = new Set((bizWithMetrics ?? []).map((row: { biz_id: string }) => row.biz_id));

    const staffNoMetricsIds = (activeStaff ?? [])
        .filter((row: { id: string }) => !staffIdsWithMetrics.has(row.id))
        .map((row: { id: string }) => row.id);
    const branchesNoMetricsIds = (activeBranches ?? [])
        .filter((row: { id: string }) => !branchIdsWithMetrics.has(row.id))
        .map((row: { id: string }) => row.id);
    const bizNoMetricsIds = (approvedBiz ?? [])
        .filter((row: { id: string }) => !bizIdsWithMetrics.has(row.id))
        .map((row: { id: string }) => row.id);

    let staffNoMetricsList: { id: string; full_name: string | null; biz_id: string; branch_id: string }[] = [];
    let branchesNoMetricsList: { id: string; name: string; biz_id: string }[] = [];
    let businessesNoMetricsList: { id: string; name: string | null; slug: string | null }[] = [];

    const limitNoMetrics = 500;

    if (staffNoMetricsIds.length > 0) {
        const { data } = await admin
            .from('staff')
            .select('id, full_name, biz_id, branch_id')
            .in('id', staffNoMetricsIds.slice(0, limitNoMetrics));
        staffNoMetricsList = data ?? [];
    }

    if (branchesNoMetricsIds.length > 0) {
        const { data } = await admin
            .from('branches')
            .select('id, name, biz_id')
            .in('id', branchesNoMetricsIds.slice(0, limitNoMetrics));
        branchesNoMetricsList = data ?? [];
    }

    if (bizNoMetricsIds.length > 0) {
        const { data } = await admin
            .from('businesses')
            .select('id, name, slug')
            .in('id', bizNoMetricsIds.slice(0, limitNoMetrics));
        businessesNoMetricsList = data ?? [];
    }

    let recentErrors: unknown[] = [];
    try {
        const { data } = await admin
            .from('rating_recalc_errors')
            .select('id, entity_id, entity_type, metric_date, error_message, created_at')
            .order('created_at', { ascending: false })
            .limit(100);
        recentErrors = data ?? [];
    } catch {
        recentErrors = [];
    }

    return {
        ok: true,
        data: {
            days,
            window_since: windowStartStr,
            with_null_rating: {
                staff: staffNull ?? [],
                branches: branchesNull ?? [],
                businesses: businessesNull ?? [],
            },
            without_metrics_since: {
                staff: staffNoMetricsList,
                branches: branchesNoMetricsList,
                businesses: businessesNoMetricsList,
                total_count: {
                    staff: staffNoMetricsIds.length,
                    branches: branchesNoMetricsIds.length,
                    businesses: bizNoMetricsIds.length,
                },
            },
            recent_errors: recentErrors,
        },
    };
}
