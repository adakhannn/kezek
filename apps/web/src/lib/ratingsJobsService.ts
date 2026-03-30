type AdminClientLike = {
    from: (table: string) => any;
};

export async function getRatingsJobs({
    admin,
}: {
    admin: AdminClientLike;
}): Promise<
    | { ok: true; data: { jobs: unknown[] } }
    | { ok: false; error: 'internal'; message: string; status: 500 }
> {
    const { data, error } = await admin
        .from('rating_jobs')
        .select(
            'id, created_at, started_at, finished_at, created_by, date_from, date_to, scope, status, processed_days, total_days, error_summary, error_message',
        )
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        return {
            ok: false,
            error: 'internal',
            message: error.message,
            status: 500,
        };
    }

    return {
        ok: true,
        data: {
            jobs: data ?? [],
        },
    };
}
