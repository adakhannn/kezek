import NewFromUser from '../NewFromUser';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewStaffPage() {
    try {
        const { supabase, bizId } = await getBizContextForManagers();

        const { data: branches } = await supabase
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .order('name');

        return (
            <main className="mx-auto max-w-3xl p-6 space-y-4">
                <h1 className="text-2xl font-semibold">Добавить сотрудника из пользователей</h1>
                <NewFromUser branches={branches || []} />
            </main>
        );
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Неизвестная ошибка';
        return <main className="p-6 text-red-600">Нет доступа: {msg}</main>;
    }
}
