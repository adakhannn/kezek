/** React Query keys of the staff section; every key starts with the business, so a write refreshes it all. */
export const staffQueryKeys = {
    business: (bizId: string) => ['manageStaff', bizId] as const,
    list: (bizId: string) => ['manageStaff', bizId, 'list'] as const,
    detail: (bizId: string, staffId: string) => ['manageStaff', bizId, 'detail', staffId] as const,
    services: (bizId: string, staffId: string, branchId: string) => ['manageStaff', bizId, 'services', staffId, branchId] as const,
    schedule: (bizId: string, staffId: string) => ['manageStaff', bizId, 'schedule', staffId] as const,
    finance: (bizId: string, staffId: string, date: string | null) => ['manageStaff', bizId, 'finance', staffId, date ?? 'today'] as const,
    stats: (bizId: string, staffId: string, period: string, date: string | null) => ['manageStaff', bizId, 'stats', staffId, period, date ?? 'current'] as const,
    audit: (bizId: string, staffId: string) => ['manageStaff', bizId, 'audit', staffId] as const,
};
