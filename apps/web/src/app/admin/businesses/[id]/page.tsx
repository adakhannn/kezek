import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminDangerZone } from '../../_components/AdminDangerZone';

import { BranchLimitEditor } from './BranchLimitEditor';
import { BusinessCardEdit } from './BusinessCardEdit';

import { getServerLocale, getT } from '@/app/_components/i18n/server';
import { DeleteBizButton } from '@/components/admin/DeleteBizButton';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { buttonStyles } from '@/components/ui/buttonStyles';

export const dynamic = 'force-dynamic';

type BizRow = {
    id: string;
    name: string;
    slug: string;
    categories: string[] | null;
    owner_id: string | null;
    is_approved: boolean | null;
    created_at: string | null;
    address: string | null;
    phones: string[] | null;
    branch_limit: number;
};

type OwnerMini = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
};

type RouteParams = { id: string };

export default async function BusinessDetailPage({ params }: { params: Promise<RouteParams> }) {
    const { id } = await params;
    const locale = await getServerLocale();
    const t = getT(locale);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anonKey, {
        cookies: {
            get: (name: string) => cookieStore.get(name)?.value,
            set: () => {},
            remove: () => {},
        },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return <div className="p-4">{t('admin.error.unauthorized', 'Не авторизован')}</div>;
    }

    const { data: isSuperAdmin, error: roleError } = await supabase.rpc('is_super_admin');
    if (roleError) return <div className="p-4">{t('admin.error.load', 'Ошибка')}: {roleError.message}</div>;
    if (!isSuperAdmin) return <div className="p-4">{t('admin.noAccess.title', 'Нет доступа')}</div>;

    const admin = createClient(url, serviceRoleKey);
    const { data: business, error: businessError } = await admin
        .from('businesses')
        .select('id,name,slug,categories,owner_id,is_approved,created_at,address,phones,branch_limit')
        .eq('id', id)
        .maybeSingle<BizRow>();

    if (businessError) {
        return <div className="p-4">{t('admin.error.load', 'Ошибка')}: {businessError.message}</div>;
    }
    if (!business) {
        return <div className="p-4">{t('admin.businesses.notFound', 'Бизнес не найден')}</div>;
    }

    const [branchesResult, staffResult, servicesResult, bookingsResult, categoriesResult] = await Promise.all([
        admin.from('branches').select('id', { count: 'exact', head: true }).eq('biz_id', id),
        admin.from('staff').select('id', { count: 'exact', head: true }).eq('biz_id', id),
        admin.from('services').select('id', { count: 'exact', head: true }).eq('biz_id', id),
        admin.from('bookings').select('id', { count: 'exact', head: true }).eq('biz_id', id),
        admin.from('categories').select('slug,name_ru,is_active').order('name_ru', { ascending: true }),
    ]);

    let owner: OwnerMini | null = null;
    if (business.owner_id) {
        const { data, error } = await admin.auth.admin.getUserById(business.owner_id);
        if (!error && data?.user) {
            const metadata = (data.user.user_metadata ?? {}) as Partial<{ full_name: string }>;
            owner = {
                id: data.user.id,
                email: data.user.email ?? null,
                phone: (data.user as { phone?: string | null }).phone ?? null,
                full_name: metadata.full_name?.trim() || null,
            };
        }
    }

    const branchesCount = branchesResult.count ?? 0;
    const staffCount = staffResult.count ?? 0;
    const servicesCount = servicesResult.count ?? 0;
    const bookingsCount = bookingsResult.count ?? 0;
    const categories = Array.isArray(business.categories) ? business.categories : [];
    const isApproved = business.is_approved === true;
    const categoryOptions = (categoriesResult.data ?? [])
        .filter((category) => category.is_active !== false)
        .map((category) => ({ slug: category.slug, name: category.name_ru }));

    const setupItems = [
        {
            complete: isApproved,
            label: t('admin.businessDetail.setup.approved', 'Бизнес доступен клиентам'),
            action: null,
        },
        {
            complete: Boolean(owner),
            label: t('admin.businessDetail.setup.owner', 'Назначен владелец'),
            action: `/admin/businesses/${business.id}/owner`,
        },
        {
            complete: branchesCount > 0,
            label: t('admin.businessDetail.setup.branch', 'Создан хотя бы один филиал'),
            action: `/admin/businesses/${business.id}/branches`,
        },
        {
            complete: servicesCount > 0,
            label: t('admin.businessDetail.setup.services', 'Добавлены услуги'),
            action: null,
        },
    ];
    const completedSetupItems = setupItems.filter((item) => item.complete).length;
    const dateLocale = locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU';

    return (
        <div className="space-y-6">
            <Card
                variant="elevated"
                padding="lg"
                className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--accent-primary)_16%,transparent),transparent_38%)]"
            >
                <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full border border-fuchsia-400/15" />
                <div className="relative space-y-5">
                    <Link
                        href="/admin/businesses"
                        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)]"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        {t('admin.businessDetail.back', 'Все бизнесы')}
                    </Link>

                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusChip
                                    status={isApproved ? 'approved' : 'pending'}
                                    label={
                                        isApproved
                                            ? t('admin.businesses.status.approved', 'Одобрен')
                                            : t('admin.businesses.status.moderation', 'На модерации')
                                    }
                                />
                                {categories.slice(0, 2).map((category) => (
                                    <Badge key={category} variant="accent" tone="soft">
                                        {categoryOptions.find((option) => option.slug === category)?.name ?? category}
                                    </Badge>
                                ))}
                                {categories.length > 2 ? <Badge variant="neutral">+{categories.length - 2}</Badge> : null}
                            </div>
                            <div>
                                <h1 className="type-page-title break-words text-[var(--text-primary)]">{business.name}</h1>
                                <p className="mt-2 font-mono text-sm text-[var(--text-muted)]">/b/{business.slug}</p>
                            </div>
                            <p className="type-caption text-[var(--text-muted)]">
                                {t('admin.businessDetail.created', 'Создан')}{' '}
                                {business.created_at
                                    ? new Intl.DateTimeFormat(dateLocale, { dateStyle: 'long' }).format(new Date(business.created_at))
                                    : '—'}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                            {isApproved ? (
                                <Link
                                    href={`/b/${business.slug}`}
                                    target="_blank"
                                    className={buttonStyles({ variant: 'outline', size: 'sm' })}
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14M5 7v12h12v-5" />
                                    </svg>
                                    <span>{t('admin.businessDetail.openPublic', 'Открыть на сайте')}</span>
                                </Link>
                            ) : null}
                            <Link
                                href={`/admin/businesses/${business.id}/branches`}
                                className={buttonStyles({ variant: 'outline', size: 'sm' })}
                            >
                                <BuildingIcon />
                                <span>{t('admin.businessDetail.branches', 'Филиалы')}</span>
                            </Link>
                            <Link
                                href={`/admin/businesses/${business.id}/members`}
                                className={buttonStyles({ variant: 'outline', size: 'sm' })}
                            >
                                <UsersIcon />
                                <span>{t('admin.businessDetail.members', 'Участники')}</span>
                            </Link>
                            <Link
                                href={`/admin/businesses/${business.id}/owner`}
                                className={buttonStyles({ size: 'sm' })}
                            >
                                <UserIcon />
                                <span>
                                    {owner
                                        ? t('admin.businessDetail.owner.edit', 'Изменить владельца')
                                        : t('admin.businessDetail.owner.assign', 'Назначить владельца')}
                                </span>
                            </Link>
                        </div>
                    </div>
                </div>
            </Card>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label={t('admin.businessDetail.stats.branches', 'Филиалы')}
                    value={branchesCount}
                    icon={<BuildingIcon />}
                    accent="violet"
                />
                <StatCard
                    label={t('admin.businessDetail.stats.staff', 'Сотрудники')}
                    value={staffCount}
                    icon={<UsersIcon />}
                    accent="pink"
                />
                <StatCard
                    label={t('admin.businessDetail.stats.services', 'Услуги')}
                    value={servicesCount}
                    icon={<ScissorsIcon />}
                    accent="emerald"
                />
                <StatCard
                    label={t('admin.businessDetail.stats.bookings', 'Бронирования')}
                    value={bookingsCount}
                    icon={<CalendarIcon />}
                    accent="sky"
                />
            </section>

            <Card variant="outlined" padding="lg">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] lg:items-center">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] font-bold text-[var(--accent-primary)]">
                                {completedSetupItems}/{setupItems.length}
                            </div>
                            <div>
                                <h2 className="type-section-title">
                                    {t('admin.businessDetail.setup.title', 'Готовность бизнеса')}
                                </h2>
                                <p className="type-caption mt-1 text-[var(--text-muted)]">
                                    {t(
                                        'admin.businessDetail.setup.description',
                                        'Что ещё нужно для полноценной работы и записи клиентов.',
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {setupItems.map((item) => (
                            <SetupItem
                                key={item.label}
                                complete={item.complete}
                                label={item.label}
                                href={item.action}
                                actionLabel={t('admin.businessDetail.setup.open', 'Перейти')}
                            />
                        ))}
                    </div>
                </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] xl:items-start">
                <BusinessCardEdit
                    bizId={business.id}
                    categoryOptions={categoryOptions}
                    initial={{
                        name: business.name,
                        slug: business.slug,
                        categories,
                        address: business.address,
                        phones: business.phones,
                        is_approved: isApproved,
                        created_at: business.created_at,
                    }}
                />

                <aside className="space-y-6">
                    <Card variant="elevated" padding="lg" className="space-y-5">
                        <div>
                            <h2 className="type-section-title">
                                {t('admin.businessDetail.owner.title', 'Владелец')}
                            </h2>
                            <p className="type-caption mt-1 text-[var(--text-muted)]">
                                {t(
                                    'admin.businessDetail.owner.description',
                                    'Аккаунт, который управляет бизнесом и командой.',
                                )}
                            </p>
                        </div>

                        {owner ? (
                            <div className="space-y-4 border-t border-[var(--border-subtle)] pt-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-lg font-bold text-white">
                                        {(owner.full_name || owner.email || owner.phone || '?').slice(0, 1).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-[var(--text-primary)]">
                                            {owner.full_name || owner.email || owner.phone || t('admin.businessDetail.owner.account', 'Аккаунт владельца')}
                                        </p>
                                        <StatusChip status="active" label={t('admin.businessDetail.owner.assigned', 'Назначен')} />
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    {owner.email ? (
                                        <a href={`mailto:${owner.email}`} className="block truncate text-[var(--accent-primary)] hover:underline">
                                            {owner.email}
                                        </a>
                                    ) : null}
                                    {owner.phone ? (
                                        <a href={`tel:${owner.phone}`} className="block text-[var(--accent-primary)] hover:underline">
                                            {owner.phone}
                                        </a>
                                    ) : null}
                                </div>
                                <details className="rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                                    <summary className="cursor-pointer text-xs font-medium text-[var(--text-muted)]">
                                        {t('admin.businessDetail.owner.technical', 'Технические данные')}
                                    </summary>
                                    <p className="mt-2 break-all font-mono text-xs text-[var(--text-muted)]">{owner.id}</p>
                                </details>
                                <Link
                                    href={`/admin/businesses/${business.id}/owner`}
                                    className={buttonStyles({ variant: 'outline', size: 'sm', fullWidth: true })}
                                >
                                    <span>{t('admin.businessDetail.owner.edit', 'Изменить владельца')}</span>
                                </Link>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-canvas)] p-5 text-center">
                                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                                    <UserIcon />
                                </div>
                                <p className="mt-3 font-semibold">
                                    {t('admin.businessDetail.owner.empty', 'Владелец пока не назначен')}
                                </p>
                                <p className="type-caption mt-1 text-[var(--text-muted)]">
                                    {t(
                                        'admin.businessDetail.owner.empty.description',
                                        'Без владельца бизнес нельзя полноценно передать клиенту.',
                                    )}
                                </p>
                                <Link
                                    href={`/admin/businesses/${business.id}/owner`}
                                    className={buttonStyles({ size: 'sm', fullWidth: true, className: 'mt-4' })}
                                >
                                    <span>{t('admin.businessDetail.owner.assign', 'Назначить владельца')}</span>
                                </Link>
                            </div>
                        )}
                    </Card>

                    <BranchLimitEditor
                        businessId={business.id}
                        initialLimit={business.branch_limit}
                        currentCount={branchesCount}
                    />
                </aside>
            </div>

            <AdminDangerZone
                title={t('admin.businessDetail.danger.title', 'Удаление бизнеса')}
                description={t(
                    'admin.businessDetail.danger.description',
                    'Необратимо удалит связанные записи, сотрудников, услуги, часы работы и роли. Используйте только после проверки зависимостей.',
                )}
            >
                <DeleteBizButton bizId={business.id} bizName={business.name} />
            </AdminDangerZone>
        </div>
    );
}

function StatCard({
    label,
    value,
    icon,
    accent,
}: {
    label: string;
    value: number;
    icon: ReactNode;
    accent: 'violet' | 'pink' | 'emerald' | 'sky';
}) {
    const accentClasses = {
        violet: 'bg-violet-500/12 text-violet-400',
        pink: 'bg-pink-500/12 text-pink-400',
        emerald: 'bg-emerald-500/12 text-emerald-400',
        sky: 'bg-sky-500/12 text-sky-400',
    };

    return (
        <Card variant="elevated" padding="md" className="min-w-0">
            <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentClasses[accent]}`}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">{value}</p>
                    <p className="truncate text-xs text-[var(--text-muted)] sm:text-sm">{label}</p>
                </div>
            </div>
        </Card>
    );
}

function SetupItem({
    complete,
    label,
    href,
    actionLabel,
}: {
    complete: boolean;
    label: string;
    href: string | null;
    actionLabel: string;
}) {
    const content = (
        <>
            <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    complete
                        ? 'bg-[var(--status-success-soft)] text-[var(--status-success)]'
                        : 'bg-[var(--surface-canvas)] text-[var(--text-muted)]'
                }`}
            >
                {complete ? '✓' : '·'}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
            {!complete && href ? <span className="text-xs text-[var(--accent-primary)]">{actionLabel} →</span> : null}
        </>
    );
    const className =
        'flex min-h-12 items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2';

    return href && !complete ? (
        <Link href={href} className={`${className} transition-colors hover:border-[var(--border-strong)]`}>
            {content}
        </Link>
    ) : (
        <div className={className}>{content}</div>
    );
}

function BuildingIcon() {
    return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 21h16M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2" />
        </svg>
    );
}

function UsersIcon() {
    return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m7-10a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87m-2-11.26a4 4 0 010 7.75" />
        </svg>
    );
}

function UserIcon() {
    return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 21a8 8 0 00-16 0m8-10a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
    );
}

function ScissorsIcon() {
    return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.12 14.12L19 19m-7-7l7-7m-7 7l-2.88 2.88M12 12L9.12 9.12m0 5.76a3 3 0 11-4.24 4.24 3 3 0 014.24-4.24zm0-5.76a3 3 0 11-4.24-4.24 3 3 0 014.24 4.24z" />
        </svg>
    );
}

function CalendarIcon() {
    return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
        </svg>
    );
}
