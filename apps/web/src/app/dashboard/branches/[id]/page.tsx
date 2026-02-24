import { notFound } from 'next/navigation';


// Временно скрыто
// import BranchAdminsPanel from "@/app/dashboard/branches/[id]/BranchAdminsPanel";
import BranchErrorDisplay from './BranchErrorDisplay';
import EditBranchPageClient from './EditBranchPageClient';

import { getBizContextForManagers } from '@/lib/authBiz';



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
    ] = await Promise.all([
        supabase
            .from('branches')
            .select('id,name,address,is_active,biz_id,lat,lon,rating_score,businesses!inner(slug,name,city)')
            .eq('id', id)
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
    ]);

    if (error) {
        return <BranchErrorDisplay error={error.message} />;
    }
    if (!branch || String(branch.biz_id) !== String(bizId)) return notFound();

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

    const businessesData = branch.businesses as { slug: string; name?: string | null; city?: string | null } | { slug: string; name?: string | null; city?: string | null }[] | null;
    const bizSlug = Array.isArray(businessesData) ? businessesData[0]?.slug || '' : businessesData?.slug || '';
    const bizName = Array.isArray(businessesData) ? businessesData[0]?.name || null : businessesData?.name || null;

    return (
        <EditBranchPageClient 
            branch={branch} 
            isSuperAdmin={isSuperAdmin}
            initialSchedule={initialSchedule}
            bizId={String(bizId)}
            bizSlug={bizSlug}
            bizName={bizName}
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
