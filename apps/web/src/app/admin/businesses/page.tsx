import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getT } from '@/app/_components/i18n/server';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusChip } from '@/components/ui/StatusChip';

type Biz = {
    id: string;
    slug: string;
    name: string;
    owner_id: string | null;
    created_at: string;
    is_approved: boolean | null;
    categories: string[] | null;
    address: string | null;
};

export default async function Page() {
    const t = getT('ru');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/sign-in?redirect=/admin/businesses');

    const { data: superRow, error: roleErr } = await supabase
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (roleErr || !superRow) {
        return <main className="p-6">403</main>;
    }

    const { data: list, error: listErr } = await supabase
        .from('businesses')
        .select('id,slug,name,owner_id,created_at,is_approved,categories,address')
        .order('created_at', { ascending: false });

    if (listErr) {
        return (
            <main className="p-6">
                <div className="text-red-600">{t('admin.businesses.error.load', 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё Р±РёР·РЅРµСЃРѕРІ')}: {listErr.message}</div>
            </main>
        );
    }

    const ownerIds = Array.from(new Set((list ?? []).map((b) => b.owner_id).filter(Boolean))) as string[];

    type OwnerInfo = { id: string; name?: string | null; email?: string | null };

    let ownersMap = new Map<string, string>();
    if (ownerIds.length) {
        const admin = createClient(url, service);

        const results = await Promise.all(
            ownerIds.map(async (oid) => {
                try {
                    const { data, error } = await admin.auth.admin.getUserById(oid);
                    if (error || !data?.user) return { id: oid } as OwnerInfo;
                    const meta = (data.user.user_metadata ?? {}) as Partial<{ full_name: string }>;
                    const display =
                        meta.full_name?.trim() ||
                        data.user.email?.trim() ||
                        (data.user as { phone?: string | null }).phone?.trim() ||
                        oid;
                    return { id: oid, name: display, email: data.user.email ?? null } as OwnerInfo;
                } catch {
                    return { id: oid } as OwnerInfo;
                }
            }),
        );

        ownersMap = new Map(results.map((r) => [r.id, (r.name ?? r.email ?? r.id)!]));
    }

    const admin = createClient(url, service);
    const businessIds = (list ?? []).map((b) => b.id);

    const [branchesData, staffData] = await Promise.all([
        admin.from('branches').select('biz_id').in('biz_id', businessIds),
        admin.from('staff').select('biz_id').in('biz_id', businessIds),
    ]);

    const branchesCount = new Map<string, number>();
    (branchesData.data || []).forEach((b) => {
        branchesCount.set(b.biz_id, (branchesCount.get(b.biz_id) || 0) + 1);
    });

    const staffCount = new Map<string, number>();
    (staffData.data || []).forEach((s) => {
        staffCount.set(s.biz_id, (staffCount.get(s.biz_id) || 0) + 1);
    });

    const approvedCount = (list ?? []).filter((b) => b.is_approved === true).length;
    const totalCount = (list ?? []).length;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('admin.businesses.title', 'Р‘РёР·РЅРµСЃС‹')}
                description={`${t('admin.businesses.stats.total', 'Р’СЃРµРіРѕ')}: ${totalCount} • ${t('admin.businesses.stats.approved', 'РћРґРѕР±СЂРµРЅРѕ')}: ${approvedCount}`}
                actions={
                    <Link href="/admin/businesses/new" className={buttonStyles({ size: 'md' })}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>{t('admin.businesses.create', 'РЎРѕР·РґР°С‚СЊ Р±РёР·РЅРµСЃ')}</span>
                    </Link>
                }
            />

            {!list || list.length === 0 ? (
                <EmptyState
                    icon={
                        <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    }
                    title={t('admin.businesses.empty.title', 'РџРѕРєР° РЅРµС‚ Р±РёР·РЅРµСЃРѕРІ')}
                    description={t('admin.businesses.empty.description', 'РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІС‹Р№ Р±РёР·РЅРµСЃ, С‡С‚РѕР±С‹ РЅР°С‡Р°С‚СЊ СЂР°Р±РѕС‚Сѓ')}
                    action={
                        <Link href="/admin/businesses/new">
                            <Button>{t('admin.businesses.create', 'РЎРѕР·РґР°С‚СЊ Р±РёР·РЅРµСЃ')}</Button>
                        </Link>
                    }
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {(list ?? []).map((b: Biz) => {
                        const ownerName = b.owner_id ? ownersMap.get(b.owner_id) ?? '—' : '—';
                        const branches = branchesCount.get(b.id) || 0;
                        const staff = staffCount.get(b.id) || 0;
                        const categories = b.categories || [];

                        return (
                            <Card key={b.id} variant="elevated" padding="lg" className="transition-shadow hover:shadow-[var(--shadow-lg)]">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="type-section-title text-gray-900 dark:text-gray-100">{b.name}</h3>
                                        <p className="mt-1 font-mono text-sm text-gray-500 dark:text-gray-400">{b.slug}</p>
                                    </div>
                                    <StatusChip
                                        status={b.is_approved ? 'approved' : 'pending'}
                                        label={
                                            b.is_approved
                                                ? t('admin.businesses.status.approved', 'РћРґРѕР±СЂРµРЅ')
                                                : t('admin.businesses.status.moderation', 'РќР° РјРѕРґРµСЂР°С†РёРё')
                                        }
                                    />
                                </div>

                                {categories.length > 0 ? (
                                    <div className="mb-4 flex flex-wrap gap-1.5">
                                        {categories.slice(0, 3).map((cat) => (
                                            <Badge key={cat} variant="accent" size="sm">
                                                {cat}
                                            </Badge>
                                        ))}
                                        {categories.length > 3 ? (
                                            <Badge variant="neutral" size="sm">
                                                +{categories.length - 3}
                                            </Badge>
                                        ) : null}
                                    </div>
                                ) : null}

                                {b.address ? (
                                    <div className="mb-4 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="line-clamp-1">{b.address}</span>
                                    </div>
                                ) : null}

                                <div className="mb-4 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-center gap-1">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        <span className="font-medium">{branches}</span>
                                        <span className="text-xs">{t('admin.businesses.stats.branches', 'С„РёР»РёР°Р»РѕРІ')}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <span className="font-medium">{staff}</span>
                                        <span className="text-xs">{t('admin.businesses.stats.staff', 'СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ')}</span>
                                    </div>
                                </div>

                                <div className="mb-4 text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">{t('admin.businesses.owner.label', 'Р’Р»Р°РґРµР»РµС†')}: </span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{ownerName}</span>
                                </div>

                                <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                                    {t('admin.businesses.created', 'РЎРѕР·РґР°РЅ')}: {new Date(b.created_at).toLocaleDateString('ru-RU', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </div>

                                <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                                    <Link href={`/admin/businesses/${b.id}`} className={buttonStyles({ fullWidth: true, size: 'sm' })}>
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        <span>{t('admin.businesses.open', 'РћС‚РєСЂС‹С‚СЊ')}</span>
                                    </Link>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
