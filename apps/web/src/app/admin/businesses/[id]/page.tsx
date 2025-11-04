import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { DeleteBizButton } from '@/components/admin/DeleteBizButton';

export const dynamic = 'force-dynamic';

type BizRow = {
    id: string;
    name: string;
    slug: string;
    categories: string[] | null;
    owner_id: string | null;
};

type OwnerMini = {
    id: string;
    email: string | null;
    phone: string | null;
};

type RouteParams = { id: string };

export default async function BizPage({ params }: { params: Promise<RouteParams> }) {
    const { id } = await params;

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const cookieStore = await cookies();
    const supa = createServerClient(URL, ANON, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value,
            set: () => {},
            remove: () => {},
        },
    });

    // 1) auth
    const {
        data: { user },
    } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;

    // 2) super-admin check
    const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    // 3) service client
    const admin = createClient(URL, SERVICE);

    // 4) бизнес (без address)
    const { data: biz, error: eBiz } = await admin
        .from('businesses')
        .select('id,name,slug,categories,owner_id')
        .eq('id', id)
        .maybeSingle<BizRow>();

    if (eBiz) return <div className="p-4">Ошибка: {eBiz.message}</div>;
    if (!biz) return <div className="p-4">Бизнес не найден</div>;

    // 5) краткая инфа о владельце
    let owner: OwnerMini | null = null;
    if (biz.owner_id) {
        const { data, error } = await admin.auth.admin.getUserById(biz.owner_id);
        if (!error && data?.user) {
            owner = {
                id: data.user.id,
                email: data.user.email ?? null,
                phone: (data.user as { phone?: string | null }).phone ?? null,
            };
        }
    }

    const categories = Array.isArray(biz.categories) ? biz.categories : [];

    return (
        <div className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Бизнес: {biz.name}</h1>
                <div className="flex gap-3 text-sm">
                    <Link href="/admin/businesses" className="underline">← К списку</Link>
                    <Link href={`/admin/businesses/${biz.id}/branches`} className="underline">Филиалы</Link>

                    {!biz.owner_id ? (
                        <Link
                            href={`/admin/businesses/${biz.id}/owner`}
                            className="inline-flex items-center rounded border px-3 py-1.5 hover:bg-gray-50"
                        >
                            Назначить владельца
                        </Link>
                    ) : (
                        <Link href={`/admin/businesses/${biz.id}/owner`} className="underline">
                            Редактировать владельца
                        </Link>
                    )}

                    <Link href={`/admin/businesses/${biz.id}/members`} className="underline">Участники</Link>
                </div>
            </div>

            <div className="grid gap-1">
                <div>
                    <b>Slug:</b> {biz.slug}
                </div>
                <div>
                    <b>Категории:</b> {categories.length ? categories.join(', ') : '—'}
                </div>
                <div className="text-xs text-gray-500">
                    Адреса указываются в филиалах. Перейдите в раздел «Филиалы», чтобы добавить адрес(а).
                </div>
            </div>

            <div className="border rounded p-3">
                <h3 className="font-semibold mb-2">Владелец</h3>
                {owner ? (
                    <div className="space-y-1">
                        <div><b>ID:</b> {owner.id}</div>
                        <div><b>Email:</b> {owner.email ?? '—'}</div>
                        <div><b>Телефон:</b> {owner.phone ?? '—'}</div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-500">
                        Владелец не назначен. Перейдите на страницу&nbsp;
                        <Link href={`/admin/businesses/${biz.id}/owner`} className="underline">«Владелец»</Link>
                        , чтобы назначить.
                    </div>
                )}
            </div>

            <div className="border rounded p-3">
                <h3 className="font-semibold mb-2 text-red-600">Опасная зона</h3>
                <p className="text-sm text-gray-500 mb-2">
                    Удаление безвозвратно удалит записи, сотрудников, услуги, часы работы и роли, связанные с бизнесом.
                </p>
                <DeleteBizButton bizId={biz.id} bizName={biz.name} />
            </div>
        </div>
    );
}
