import { notFound } from 'next/navigation';


// Временно скрыто
// import BranchAdminsPanel from "@/app/dashboard/branches/[id]/BranchAdminsPanel";
import BranchErrorDisplay from './BranchErrorDisplay';
import EditBranchPageClient from './EditBranchPageClient';

import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';



export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EditBranchPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { supabase, bizId } = await getBizContextForManagers();

    // Проверяем, является ли пользователь суперадмином
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    const isSuperAdmin = !!isSuper;

    // Загружаем филиал с рейтингом и конфиг рейтинга
    const [
        { data: branch, error },
        { data: ratingConfig },
        { data: business, error: businessError },
    ] = await Promise.all([
        supabase
            .from('branches')
            .select('id,name,address,is_active,biz_id,lat,lon,rating_score,contact_phone,contact_whatsapp,contact_email,website_url,inherit_business_contacts')
            .eq('id', id)
            .eq('biz_id', bizId)
            .maybeSingle(),
        supabase
            .from('rating_global_config')
            .select('staff_reviews_weight, staff_productivity_weight, staff_loyalty_weight, staff_discipline_weight, window_days')
            .eq('is_active', true)
            .order('valid_from', { ascending: false })
            .limit(1)
            .maybeSingle<{
                staff_reviews_weight: number;
                staff_productivity_weight: number;
                staff_loyalty_weight: number;
                staff_discipline_weight: number;
                window_days: number;
            }>(),
        supabase
            .from('businesses')
            .select('slug,name,contact_phone,contact_whatsapp,contact_email,website_url')
            .eq('id', bizId)
            .maybeSingle(),
    ]);

    if (error) {
        logError('EditBranchPage', 'Failed to load branch', { branchId: id, bizId, error });
        return <BranchErrorDisplay />;
    }
    if (businessError) {
        logError('EditBranchPage', 'Failed to load business context', { branchId: id, bizId, error: businessError });
        return <BranchErrorDisplay />;
    }
    if (!branch || !business) return notFound();

    // Загружаем расписание филиала
    const { data: scheduleData } = await supabase
        .from('branch_working_hours')
        .select('day_of_week, intervals, breaks')
        .eq('biz_id', bizId)
        .eq('branch_id', branch.id)
        .order('day_of_week');

    const initialSchedule = (scheduleData || []).map((s) => ({
        day_of_week: s.day_of_week,
        intervals: (s.intervals || []) as Array<{ start: string; end: string }>,
        breaks: (s.breaks || []) as Array<{ start: string; end: string }>,
    }));

    return (
        <EditBranchPageClient 
            branch={branch} 
            isSuperAdmin={isSuperAdmin}
            initialSchedule={initialSchedule}
            bizId={String(bizId)}
            bizSlug={business.slug}
            bizName={business.name}
            businessContacts={{
                contact_phone: business.contact_phone,
                contact_whatsapp: business.contact_whatsapp,
                contact_email: business.contact_email,
                website_url: business.website_url,
            }}
            yandexMapsApiKey={process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY}
            ratingScore={branch.rating_score}
            ratingWeights={ratingConfig ? {
                reviews: ratingConfig.staff_reviews_weight,
                productivity: ratingConfig.staff_productivity_weight,
                loyalty: ratingConfig.staff_loyalty_weight,
                discipline: ratingConfig.staff_discipline_weight,
                windowDays: ratingConfig.window_days,
            } : null}
        />
    );
}
