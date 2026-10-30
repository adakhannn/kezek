type IdentityRow = { id: string; client_id?: string | null; client_name?: string | null; full_name?: string | null };
type IdentityQuery = {
    eq: (column: string, value: string) => IdentityQuery;
    in: (column: string, values: string[]) => PromiseLike<{ data: IdentityRow[] | null; error: unknown }>;
};
type IdentityTable = { select: (columns: string) => IdentityQuery };
type QueryClient = { from: (table: string) => unknown };
type LinkedBooking = { id: string; client_id: string | null; client_name: string | null };

/** Resolve names only for bookings the manager can read in the current business. */
export async function listDashboardBookingClientIdentities({
    supabase, admin, bizId, bookingIds,
}: { supabase: QueryClient; admin: QueryClient; bizId: string; bookingIds: string[] }) {
    if (bookingIds.length === 0) return [];
    const { data: bookings, error: bookingError } = await (supabase.from('bookings') as IdentityTable)
        .select('id,client_id,client_name').eq('biz_id', bizId).in('id', bookingIds);
    if (bookingError) throw new Error('Unable to read booking identities');
    const missing = (bookings ?? []).filter(booking =>
        booking.client_id && !booking.client_name?.trim()) as LinkedBooking[];
    const clientIds = [...new Set(missing.map(booking => booking.client_id as string))];
    if (clientIds.length === 0) return [];
    // Profiles remain self-only in the Data API. The privileged lookup is bounded by
    // the preceding authenticated, business-scoped booking read, not caller user IDs.
    const { data: profiles, error: profileError } = await (admin.from('profiles') as IdentityTable)
        .select('id,full_name').in('id', clientIds);
    if (profileError) throw new Error('Unable to read client names');
    const names = new Map<string, string>((profiles ?? []).map(profile =>
        [profile.id, profile.full_name?.trim() ?? '']));
    return missing.flatMap(booking => {
        const name = names.get(booking.client_id as string);
        return name ? [{ bookingId: booking.id, name }] : [];
    });
}
