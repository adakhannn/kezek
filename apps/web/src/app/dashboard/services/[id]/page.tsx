import { notFound } from 'next/navigation';

import ServiceForm from '../ServiceForm';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EditServicePage({ params }: { params: { id: string } }) {
    const { supabase, bizId } = await getBizContextForManagers();

    const [{ data: svc }, { data: branches }] = await Promise.all([
        supabase
            .from('services')
            .select('id,name_ru,duration_min,price_from,price_to,active,branch_id,biz_id')
            .eq('id', params.id)
            .maybeSingle(),
        supabase
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name'),
    ]);

    if (!svc || String(svc.biz_id) !== String(bizId)) return notFound();

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Редактирование услуги</h1>
            <ServiceForm
                initial={{
                    id: String(svc.id),
                    name_ru: String(svc.name_ru),
                    duration_min: Number(svc.duration_min),
                    price_from: Number(svc.price_from),
                    price_to: Number(svc.price_to),
                    active: !!svc.active,
                    branch_id: String(svc.branch_id),
                }}
                branches={branches || []}
                apiBase="/api/services"
            />
        </main>
    );
}
