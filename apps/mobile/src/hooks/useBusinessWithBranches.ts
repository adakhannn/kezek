/**
 * Хук загрузки бизнеса и филиалов по slug (для мобильного флоу бронирования).
 * Вынес из BookingStep1Branch для переиспользования и разделения слоёв.
 */

import { useQuery } from '@tanstack/react-query';
import { useLanguage, type Translate } from '../i18n';
import { supabase } from '../lib/supabase';

export type BusinessRow = {
    id: string;
    name: string;
    slug: string;
    rating_score: number | null;
    /** businesses.tz: the zone of the slot times and booking days (ARCH-11). */
    tz?: string | null;
};

export type BranchRow = {
    id: string;
    name: string;
    rating_score: number | null;
};

export type BusinessWithBranches = {
    business: BusinessRow;
    branches: BranchRow[];
};

async function fetchBusinessWithBranches(slug: string, t: Translate): Promise<BusinessWithBranches> {
    const { data: biz, error: bizError } = await supabase
        .from('businesses')
        .select('id, name, slug, rating_score, tz')
        .eq('slug', slug)
        .eq('is_approved', true)
        .single();

    if (bizError) throw bizError;
    if (!biz) throw new Error(t('booking.error.businessNotFound'));

    const { data: branches, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, rating_score')
        .eq('biz_id', biz.id)
        .eq('is_active', true)
        .order('rating_score', { ascending: false, nullsFirst: false })
        .order('name');

    if (branchesError) throw branchesError;

    return {
        business: biz as BusinessRow,
        branches: (branches ?? []) as BranchRow[],
    };
}

export function useBusinessWithBranches(slug: string | undefined) {
    const { t } = useLanguage();
    return useQuery({
        queryKey: ['businessWithBranches', slug],
        queryFn: () => fetchBusinessWithBranches(slug!, t),
        enabled: !!slug,
    });
}
