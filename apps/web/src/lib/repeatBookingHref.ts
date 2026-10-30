type RepeatSelection = {
    slug: string;
    branchId?: string | null;
    staffId?: string | null;
    serviceIds: string[];
};

/** Repeating a visit starts a new booking; never carry an old slot or date. */
export function repeatBookingHref({ slug, branchId, staffId, serviceIds }: RepeatSelection): string {
    const services = [...new Set(serviceIds.filter(Boolean))];
    const params = new URLSearchParams();
    params.set('step', branchId && staffId && services.length ? '4' : '1');
    if (branchId) params.set('branch', branchId);
    if (staffId) params.set('staff', staffId);
    for (const id of services) params.append('service', id);
    return `/b/${encodeURIComponent(slug)}/booking?${params}`;
}
