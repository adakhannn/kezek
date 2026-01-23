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

    const { data: branch, error } = await supabase
        .from('branches')
        .select('id,name,address,is_active,biz_id,lat,lon,businesses!inner(slug)')
        .eq('id', id)
        .maybeSingle();

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

    const businessesData = branch.businesses as { slug: string } | { slug: string }[] | null;
    const bizSlug = Array.isArray(businessesData) ? businessesData[0]?.slug || '' : businessesData?.slug || '';

    return (
        <EditBranchPageClient 
            branch={branch} 
            isSuperAdmin={isSuperAdmin}
            initialSchedule={initialSchedule}
            bizId={String(bizId)}
            bizSlug={bizSlug}
        />
    );
}
