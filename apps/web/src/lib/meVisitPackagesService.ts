type UserLike = {
    id: string;
};

type PackagesAdminLike = {
    from: (table: string) => any;
};

type VisitPackageRow = {
    id: string;
    client_id: string;
    plan_id: string;
    remaining_visits: number;
    valid_until: string;
    purchased_at: string;
    created_at: string;
};

type VisitPackagePlanRow = {
    id: string;
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
    visit_count: number;
};

export type MeVisitPackagesResult =
    | {
          ok: true;
          data: {
              packages: Array<{
                  id: string;
                  plan_id: string;
                  plan_name_ru: string | null;
                  plan_name_ky: string | null;
                  plan_name_en: string | null;
                  remaining_visits: number;
                  plan_visit_count: number | null;
                  valid_until: string;
                  purchased_at: string;
                  created_at: string;
              }>;
          };
      }
    | {
          ok: false;
          error: 'server';
          message: string;
          details?: unknown;
          status: number;
      };

export async function listCurrentUserVisitPackages({
    admin,
    user,
    includeAll,
    today,
}: {
    admin: PackagesAdminLike;
    user: UserLike;
    includeAll: boolean;
    today: string;
}): Promise<MeVisitPackagesResult> {
    let query = admin
        .from('client_visit_packages')
        .select('id, client_id, plan_id, remaining_visits, valid_until, purchased_at, created_at')
        .eq('client_id', user.id)
        .order('valid_until', { ascending: true });

    if (!includeAll) {
        query = query.gte('valid_until', today).gt('remaining_visits', 0) as typeof query;
    }

    const { data: rows, error } = await query;

    if (error) {
        return {
            ok: false,
            error: 'server',
            message: 'Не удалось загрузить пакеты',
            details: error.message,
            status: 500,
        };
    }

    const planIds = [...new Set((rows ?? []).map((row: VisitPackageRow) => row.plan_id))];
    if (planIds.length === 0) {
        return {
            ok: true,
            data: { packages: [] },
        };
    }

    const { data: planRows } = await admin
        .from('visit_package_plans')
        .select('id, name_ru, name_ky, name_en, visit_count')
        .in('id', planIds) as { data: VisitPackagePlanRow[] | null };

    const planMap = new Map(
        (planRows ?? []).map((plan: VisitPackagePlanRow) => [
            plan.id,
            {
                name_ru: plan.name_ru,
                name_ky: plan.name_ky ?? null,
                name_en: plan.name_en ?? null,
                visit_count: plan.visit_count,
            },
        ]),
    );

    return {
        ok: true,
        data: {
            packages: (rows ?? []).map((row: VisitPackageRow) => {
                const plan = planMap.get(row.plan_id);
                return {
                    id: row.id,
                    plan_id: row.plan_id,
                    plan_name_ru: plan?.name_ru ?? null,
                    plan_name_ky: plan?.name_ky ?? null,
                    plan_name_en: plan?.name_en ?? null,
                    remaining_visits: row.remaining_visits,
                    plan_visit_count: plan?.visit_count ?? null,
                    valid_until: row.valid_until,
                    purchased_at: row.purchased_at,
                    created_at: row.created_at,
                };
            }),
        },
    };
}
