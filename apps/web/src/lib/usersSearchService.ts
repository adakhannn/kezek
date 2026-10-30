import { getServiceClient } from '@/lib/supabaseService';

type UsersSearchInput = {
    q?: string;
    page: number;
    perPage: number;
};

type UsersSearchContext = {
    supabase: any;
    bizId: string;
    input: UsersSearchInput;
};

export async function runUsersSearch({ supabase, bizId, input }: UsersSearchContext) {
    const query = (input.q ?? '').trim().slice(0, 100).toLowerCase();
    const pageNum = Math.max(1, Math.min(100, input.page));
    const perPageNum = Math.max(1, Math.min(100, input.perPage));

    // A missing search term must never become a platform account directory.
    // Keep this guard below HTTP validation too, for direct service consumers.
    if (!query) {
        return { items: [], page: pageNum, perPage: perPageNum };
    }

    const admin = getServiceClient();
    const { data, error } = await admin.auth.admin.listUsers({
        page: pageNum,
        perPage: perPageNum,
    });

    if (error) {
        throw new Error(error.message);
    }

    const users = data.users ?? [];
    const userIds = users.map(user => user.id);
    const [staffResult, profileResult] = await Promise.all([
        supabase.from('staff').select('user_id').eq('biz_id', bizId).not('user_id', 'is', null),
        userIds.length
            ? admin.from('profiles').select('id,full_name').in('id', userIds)
            : Promise.resolve({ data: [], error: null }),
    ]);
    if (profileResult.error) throw new Error('Client profile names unavailable');
    const existingStaff = staffResult.data;
    // Match only the already authorized Auth page; do not expose additional profile
    // fields or use display names/provider metadata to make authorization decisions.
    const profileNames = new Map<string, string>((profileResult.data ?? []).map(profile =>
        [profile.id, typeof profile.full_name === 'string' ? profile.full_name.trim() : '']));

    const existingStaffUserIds = new Set(
        (existingStaff ?? [])
            .map((staff: { user_id?: unknown }) => staff.user_id)
            .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0),
    );

    const mapped = users
        .map((user: { id: string; email?: string | null; phone?: string | null; user_metadata?: Record<string, unknown> | null }) => {
            const meta = user.user_metadata ?? {};
            return {
                id: user.id,
                email: user.email ?? null,
                phone: user.phone ?? null,
                full_name:
                    profileNames.get(user.id) ||
                    (
                        (typeof meta.full_name === 'string' ? meta.full_name : undefined) ??
                        (typeof meta.fullName === 'string' ? meta.fullName : undefined) ??
                        user.email ??
                        'Без имени'
                    ),
            };
        })
        .filter(user => !existingStaffUserIds.has(user.id));

    const items = query
        ? mapped.filter(
              user =>
                  (user.email ?? '').toLowerCase().includes(query) ||
                  (user.phone ?? '').includes(query) ||
                  (user.full_name ?? '').toLowerCase().includes(query),
          )
        : mapped;

    return {
        items,
        page: pageNum,
        perPage: perPageNum,
    };
}
