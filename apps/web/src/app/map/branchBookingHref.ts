export function branchBookingHref(businessSlug: string, branchId: string) {
    return `/b/${encodeURIComponent(businessSlug)}/booking?${new URLSearchParams({branch: branchId})}`;
}
