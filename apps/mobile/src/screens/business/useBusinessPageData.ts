import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';
import type {
    BusinessPageBranch,
    BusinessPageBusiness,
    BusinessPageData,
    BusinessPagePromotion,
    BusinessPageService,
    BusinessPageStaff,
} from './businessPageModel';

/**
 * The public data of one approved business, read with the anon key like the web page
 * (apps/web/src/app/b/[slug]/page.tsx): the same tables, columns, filters and order, so RLS
 * lets it through signed out. null: no approved business has this slug.
 */
export async function fetchBusinessPage(slug: string): Promise<BusinessPageData | null> {
    const { data: business, error } = await supabase
        .from('businesses')
        .select('id,slug,name,address,phones,contact_phone,contact_whatsapp,contact_email,website_url,rating_score,tz')
        .eq('slug', slug)
        .eq('is_approved', true)
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    if (!business) return null;

    const biz = business as BusinessPageBusiness;
    const [branchesResult, servicesResult, staffResult] = await Promise.all([
        supabase
            .from('branches')
            .select('id,name,address,rating_score,directory_links,contact_phone,contact_whatsapp,contact_email,website_url,inherit_business_contacts')
            .eq('biz_id', biz.id)
            .eq('is_active', true)
            .order('rating_score', { ascending: false, nullsFirst: false })
            .order('name', { ascending: true }),
        supabase
            .from('services')
            .select('id,name_ru,name_ky,name_en,duration_min,price_from,price_to,branch_id')
            .eq('biz_id', biz.id)
            .eq('active', true)
            .order('name_ru', { ascending: true }),
        supabase
            .from('staff')
            .select('id,full_name,branch_id,avatar_url,rating_score')
            .eq('biz_id', biz.id)
            .eq('is_active', true)
            .order('rating_score', { ascending: false, nullsFirst: false })
            .order('full_name', { ascending: true }),
    ]);

    if (branchesResult.error) throw branchesResult.error;
    if (servicesResult.error) throw servicesResult.error;
    if (staffResult.error) throw staffResult.error;

    const branches = (branchesResult.data ?? []) as BusinessPageBranch[];
    let promotions: BusinessPagePromotion[] = [];

    if (branches.length > 0) {
        // RLS returns only the active promotions inside their validity dates.
        const promotionsResult = await supabase
            .from('branch_promotions')
            .select('id,branch_id,promotion_type,title_ru,title_ky,title_en,description_ru,description_ky,description_en,params,valid_from,valid_to')
            .in('branch_id', branches.map((branch) => branch.id))
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(50);

        if (promotionsResult.error) throw promotionsResult.error;
        promotions = (promotionsResult.data ?? []) as BusinessPagePromotion[];
    }

    return {
        business: biz,
        branches,
        services: (servicesResult.data ?? []) as BusinessPageService[],
        staff: (staffResult.data ?? []) as BusinessPageStaff[],
        promotions,
    };
}

export function useBusinessPageData(slug: string | undefined) {
    return useQuery({
        queryKey: ['business-page', slug],
        queryFn: () => fetchBusinessPage(slug!),
        enabled: !!slug,
    });
}
