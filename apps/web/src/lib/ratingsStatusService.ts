export type RatingsStatusAdminQueryLike = {
  from: (table: string) => {
    select: (...args: unknown[]) => unknown;
  };
};

function createMetricMaxQuery(admin: RatingsStatusAdminQueryLike, table: string) {
  const query = admin.from(table).select('metric_date') as {
    order: (...args: unknown[]) => {
      limit: (...args: unknown[]) => {
        maybeSingle: () => Promise<{ data?: { metric_date?: string | null } | null }>;
      };
    };
  };

  return query.order('metric_date', { ascending: false }).limit(1).maybeSingle();
}

function createLastRatingQuery(admin: RatingsStatusAdminQueryLike, table: string) {
  const query = admin.from(table).select('last_rating_recalculated_at') as {
    order: (...args: unknown[]) => {
      not: (...args: unknown[]) => {
        limit: (...args: unknown[]) => {
          maybeSingle: () => Promise<{ data?: { last_rating_recalculated_at?: string | null } | null }>;
        };
      };
    };
  };

  return query
    .order('last_rating_recalculated_at', { ascending: false })
    .not('last_rating_recalculated_at', 'is', null)
    .limit(1)
    .maybeSingle();
}

function createNullRatingCountQuery(admin: RatingsStatusAdminQueryLike, table: string) {
  const query = admin.from(table).select('id', { count: 'exact', head: true }) as {
    is: (...args: unknown[]) => Promise<{ count?: number | null }>;
  };

  return query.is('rating_score', null);
}

export async function getRatingsStatus(
  admin: RatingsStatusAdminQueryLike,
  options?: { errorsWindowDaysParam?: string | null },
) {
  const [
    { data: staffMax },
    { data: branchMax },
    { data: bizMax },
    { data: staffLastRating },
    { data: branchLastRating },
    { data: bizLastRating },
  ] = await Promise.all([
    createMetricMaxQuery(admin, 'staff_day_metrics'),
    createMetricMaxQuery(admin, 'branch_day_metrics'),
    createMetricMaxQuery(admin, 'biz_day_metrics'),
    createLastRatingQuery(admin, 'staff'),
    createLastRatingQuery(admin, 'branches'),
    createLastRatingQuery(admin, 'businesses'),
  ]);

  const [
    { count: staffNoRating },
    { count: branchesNoRating },
    { count: bizNoRating },
  ] = await Promise.all([
    createNullRatingCountQuery(admin, 'staff'),
    createNullRatingCountQuery(admin, 'branches'),
    createNullRatingCountQuery(admin, 'businesses'),
  ]);

  const MAX_DAYS = 7;
  const errorsWindowDays = Math.min(
    MAX_DAYS,
    Math.max(
      1,
      Number.parseInt(options?.errorsWindowDaysParam ?? String(MAX_DAYS), 10) || MAX_DAYS,
    ),
  );

  const errorsSinceDate = new Date();
  errorsSinceDate.setDate(errorsSinceDate.getDate() - errorsWindowDays + 1);
  const errorsSinceIso = errorsSinceDate.toISOString().slice(0, 10);

  let recentErrorsTotal = 0;
  let recentErrorsByType: Record<string, number> = {};

  try {
    const query = admin.from('rating_recalc_errors').select('entity_type, metric_date') as {
      gte: (...args: unknown[]) => Promise<{
        data?: Array<{ entity_type: string }> | null;
      }>;
    };

    const { data: recentErrors } = await query.gte('metric_date', errorsSinceIso) as {
      data?: Array<{ entity_type: string }> | null;
    };

    if (recentErrors && recentErrors.length > 0) {
      recentErrorsTotal = recentErrors.length;
      for (const row of recentErrors) {
        recentErrorsByType[row.entity_type] = (recentErrorsByType[row.entity_type] ?? 0) + 1;
      }
    }
  } catch {
    recentErrorsTotal = 0;
    recentErrorsByType = {};
  }

  return {
    staff_last_metric_date: staffMax?.metric_date ?? null,
    branch_last_metric_date: branchMax?.metric_date ?? null,
    biz_last_metric_date: bizMax?.metric_date ?? null,
    staff_last_rating_recalculated_at: staffLastRating?.last_rating_recalculated_at ?? null,
    branch_last_rating_recalculated_at: branchLastRating?.last_rating_recalculated_at ?? null,
    biz_last_rating_recalculated_at: bizLastRating?.last_rating_recalculated_at ?? null,
    staff_without_rating: staffNoRating ?? null,
    branches_without_rating: branchesNoRating ?? null,
    businesses_without_rating: bizNoRating ?? null,
    recent_errors_total: recentErrorsTotal,
    recent_errors_by_type: recentErrorsByType,
    recent_errors_days: errorsWindowDays,
    has_recent_errors: recentErrorsTotal > 0,
  };
}
