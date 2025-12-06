// apps/web/src/app/[slug]/page.tsx
import { JSX } from 'react';

import BizClient from './view';

import { getSupabaseServer } from '@/lib/authBiz';


type Biz = { id: string; slug: string; name: string; address: string; phones: string[] };
type Branch = { id: string; name: string };
type Service = {
    id: string;
    name_ru: string;
    duration_min: number;
    price_from: number | null;
    price_to: number | null;
    active: boolean;
    branch_id: string;
};
type Staff = { id: string; full_name: string; branch_id: string };

async function getData(slug: string) {
    const supabase = await getSupabaseServer();

    // Получаем бизнес по slug
    const { data: bizRaw, error: bizError } = await supabase
        .from('businesses')
        .select('id,slug,name,address,phones')
        .eq('slug', slug)
        .eq('is_approved', true)
        .maybeSingle<{ id: string; slug: string; name: string; address: string | null; phones: string[] | null }>();

    if (bizError || !bizRaw) return null;

    // Приводим к типу Biz (address и phones не могут быть null в типе)
    const biz: Biz = {
        ...bizRaw,
        address: bizRaw.address ?? '',
        phones: bizRaw.phones ?? [],
    };

    // Получаем филиалы
    const { data: branches, error: branchesError } = await supabase
        .from('branches')
        .select('id,name')
        .eq('biz_id', biz.id)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .returns<Branch[]>();

    if (branchesError) throw new Error(`Failed to fetch branches: ${branchesError.message}`);

    // Все активные услуги бизнеса (дальше фильтруем по филиалу)
    const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id,name_ru,duration_min,price_from,price_to,active,branch_id')
        .eq('biz_id', biz.id)
        .eq('active', true)
        .order('name_ru', { ascending: true })
        .returns<Service[]>();

    if (servicesError) throw new Error(`Failed to fetch services: ${servicesError.message}`);

    // Активные мастера с их "родным" филиалом
    const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id,full_name,branch_id')
        .eq('biz_id', biz.id)
        .eq('is_active', true)
        .order('full_name', { ascending: true })
        .returns<Staff[]>();

    if (staffError) throw new Error(`Failed to fetch staff: ${staffError.message}`);

    return { biz, branches: branches ?? [], services: services ?? [], staff: staff ?? [] };
}

export default async function Page({
                                       params,
                                   }: {
    params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
    const { slug } = await params;
    const data = await getData(slug);
    if (!data) return <main className="p-6">Бизнес не найден</main>;
    return <BizClient data={data} />;
}
