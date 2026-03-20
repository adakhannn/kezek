import type { Business } from './types';

export function getDashboardSubtitleLabel(count: number): string {
    return count === 1 ? 'Управление бизнесом' : 'Управление бизнесами';
}

export function getPrimaryBusinessPhone(business: Pick<Business, 'phones'>): string | null {
    const firstPhone = business.phones?.find(Boolean)?.trim();
    return firstPhone || null;
}
