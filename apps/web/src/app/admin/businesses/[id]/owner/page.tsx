import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { OwnerForm } from './ui/OwnerForm';

export const dynamic = 'force-dynamic';

type BizRow = {
    id: string;
    name: string;
    owner_id: string | null;
};

type UserRow = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
    is_suspended: boolean | null;
};

type RouteParams = { id: string };

export default async function OwnerPage({ params }: { params: Promise<RouteParams> }) {
    const { id } = await params;

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {},
        },
    });

    // 1) Авторизация
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;

    // 2) Проверка супера
    const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    // 3) Сервисный клиент
    const admin = createClient(URL, SERVICE);

    // 4) Бизнес
    const { data: biz, error: eBiz } = await admin
        .from('businesses')
        .select('id,name,owner_id')
        .eq('id', id)
        .maybeSingle<BizRow>();

    if (eBiz) return <div className="p-4">Ошибка: {eBiz.message}</div>;
    if (!biz) return <div className="p-4">Бизнес не найден</div>;

    // 5) Получаем информацию о текущем владельце (если есть)
    let currentOwner: UserRow | null = null;
    if (biz.owner_id) {
        try {
            const { data: ownerData, error: ownerErr } = await admin.auth.admin.getUserById(biz.owner_id);
            if (!ownerErr && ownerData?.user) {
                const { data: profile } = await admin
                    .from('profiles')
                    .select('full_name')
                    .eq('id', biz.owner_id)
                    .maybeSingle();
                
                currentOwner = {
                    id: ownerData.user.id,
                    email: ownerData.user.email ?? null,
                    phone: (ownerData.user as { phone?: string | null }).phone ?? null,
                    full_name: profile?.full_name ?? (ownerData.user.user_metadata?.full_name as string | undefined) ?? null,
                    is_suspended: null, // Проверка блокировки будет на клиенте при необходимости
                };
            }
        } catch (e) {
            console.warn('Failed to fetch current owner:', e);
        }
    }

    return (
        <div className="space-y-6">
            {/* Заголовок */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent mb-2">
                            Назначить владельца
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Бизнес: <span className="font-medium text-gray-900 dark:text-gray-100">{biz.name}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Форма */}
            <OwnerForm
                bizId={biz.id}
                currentOwnerId={biz.owner_id}
                currentOwner={currentOwner}
            />
        </div>
    );
}
