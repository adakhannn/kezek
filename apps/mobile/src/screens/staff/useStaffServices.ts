import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';

export type StaffService = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from: number | null;
    price_to: number | null;
};

type Row = { is_active: boolean | null; services: (StaffService & { active?: boolean | null }) | (StaffService & { active?: boolean | null })[] | null };

/** The active services of the active assignments, as the website's staff cabinet ("Мои услуги"). */
export function toStaffServices(rows: Row[]): StaffService[] {
    return rows.flatMap((row) => {
        if (!row.is_active) return [];
        const service = Array.isArray(row.services) ? row.services[0] : row.services;
        if (!service || service.active !== true) return [];
        const { active: _active, ...rest } = service;
        return [rest];
    });
}

export function useStaffServices(staffId: string | undefined) {
    return useQuery({
        queryKey: ['staff-services', staffId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('service_staff')
                .select('is_active, service_id, services:services(id, name_ru, name_ky, name_en, duration_min, price_from, price_to, active)')
                .eq('staff_id', staffId as string)
                .eq('is_active', true);
            if (error) throw error;
            return toStaffServices((data ?? []) as Row[]);
        },
        enabled: !!staffId,
    });
}

/** "500 - 800 сом", "от 500 сом" or "до 800 сом" (web staff cabinet), or null without a price. */
export function staffServicePriceKey(service: Pick<StaffService, 'price_from' | 'price_to'>):
    | { key: 'parity.staffServices.priceBetween'; params: { from: string; to: string } }
    | { key: 'parity.staffServices.priceFromValue' | 'parity.staffServices.priceToValue'; params: { price: string } }
    | null {
    const { price_from: from, price_to: to } = service;
    if (from && to) return { key: 'parity.staffServices.priceBetween', params: { from: String(from), to: String(to) } };
    if (from) return { key: 'parity.staffServices.priceFromValue', params: { price: String(from) } };
    if (to) return { key: 'parity.staffServices.priceToValue', params: { price: String(to) } };
    return null;
}
