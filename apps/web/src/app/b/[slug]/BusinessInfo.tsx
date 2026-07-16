'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { RatingDisplay } from '@/components/RatingDisplay';
import { Badge } from '@/components/ui/Badge';
import { Card, cardStyles } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { buttonStyles } from '@/components/ui/buttonStyles';
import { formatStaffName, getServiceName } from '@/lib/i18nHelpers';
import { supabase } from '@/lib/supabaseClient';

type Biz = { id: string; slug: string; name: string; address: string; phones: string[]; rating_score: number | null };
type Branch = { id: string; name: string; address?: string | null; rating_score: number | null; directory_links?: Record<string, string | null> | null };
type Service = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from?: number | null;
    price_to?: number | null;
    branch_id: string;
};
type Staff = { id: string; full_name: string; branch_id: string; avatar_url?: string | null; rating_score: number | null };
type Promotion = {
    id: string;
    branch_id: string;
    promotion_type: string;
    title_ru: string | null;
    params: Record<string, unknown>;
    branches?: { name: string };
};

type Data = {
    biz: Biz;
    branches: Branch[];
    services: Service[];
    staff: Staff[];
    promotions?: Promotion[];
};

export default function BusinessInfo({ data }: { data: Data }) {
    const { biz, branches, services, staff, promotions = [] } = data;
    const { t, locale } = useLanguage();
    const queryClient = useQueryClient();

    const handlePrefetchBookingData = () => {
        const branchIds = branches.map((branch) => branch.id);
        const staffIds = staff.map((person) => person.id);

        branchIds.forEach((branchId) => {
            queryClient.prefetchQuery({
                queryKey: ['branch-promotions', branchId],
                queryFn: async () => {
                    const { data: promoData, error } = await supabase
                        .from('branch_promotions')
                        .select('id, promotion_type, title_ru, params')
                        .eq('branch_id', branchId)
                        .eq('is_active', true)
                        .order('created_at', { ascending: false });

                    if (error) throw error;
                    return (promoData || []) as Array<{
                        id: string;
                        promotion_type: string;
                        title_ru: string | null;
                        params: Record<string, unknown>;
                    }>;
                },
                staleTime: 2 * 60 * 1000,
            });
        });

        if (staffIds.length > 0) {
            queryClient.prefetchQuery({
                queryKey: ['service-staff', biz.id, staffIds.sort().join(',')],
                queryFn: async () => {
                    const { data: serviceStaffData, error } = await supabase
                        .from('service_staff')
                        .select('service_id, staff_id, is_active')
                        .eq('is_active', true)
                        .in('staff_id', staffIds);

                    if (error) throw error;
                    return (serviceStaffData || []) as Array<{ service_id: string; staff_id: string; is_active: boolean }>;
                },
                staleTime: 5 * 60 * 1000,
            });
        }
    };

    const formatName = (name: string): string => formatStaffName(name, locale);
    const ratedBranches = branches.filter((branch) => typeof branch.rating_score === 'number').length;
    const ratedStaff = staff.filter((person) => typeof person.rating_score === 'number').length;

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_26%),radial-gradient(circle_at_top_right,rgba(244,114,182,0.07),transparent_24%),linear-gradient(180deg,var(--surface-canvas),color-mix(in_srgb,var(--surface-muted)_72%,var(--surface-canvas)))]">
            <div className="mx-auto flex w-full max-w-[var(--container-xl)] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                <section className="overflow-hidden rounded-[32px] border border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_26%),linear-gradient(180deg,color-mix(in_srgb,var(--surface-card)_96%,transparent),color-mix(in_srgb,var(--surface-elevated)_98%,transparent))] p-6 shadow-[var(--shadow-lg)] sm:p-8">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                        <div className="space-y-5">
                            <PageHeader
                                eyebrow={
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="accent">
                                            {t('business.hero.badge', 'Проверенный бизнес')}
                                        </Badge>
                                        {promotions.length > 0 ? (
                                            <Badge variant="success">
                                                {promotions.length} {t('business.hero.promotions', 'акции')}
                                            </Badge>
                                        ) : null}
                                        <Badge variant="info">
                                            {t('business.hero.bookable', 'Онлайн-запись доступна')}
                                        </Badge>
                                    </div>
                                }
                                title={biz.name}
                                description={t(
                                    'business.hero.description',
                                    'Страница заранее показывает филиалы, команду и предложения, чтобы пользователь понимал, что именно он бронирует и почему стоит идти дальше.',
                                )}
                                meta={
                                    <div className="flex flex-wrap items-center gap-3">
                                        <RatingDisplay score={biz.rating_score} t={t} variant="badge" className="px-3 py-1" />
                                        {biz.address ? (
                                            <span className="type-caption rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-1.5 text-[var(--text-secondary)]">
                                                {biz.address}
                                            </span>
                                        ) : null}
                                        {biz.phones?.length ? (
                                            <span className="type-caption rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-1.5 text-[var(--text-secondary)]">
                                                {biz.phones.join(', ')}
                                            </span>
                                        ) : null}
                                    </div>
                                }
                                actions={
                                    <div className="flex flex-col gap-2 sm:items-end">
                                        <Link
                                            href={`/b/${biz.slug}/booking`}
                                            onMouseEnter={handlePrefetchBookingData}
                                            onFocus={handlePrefetchBookingData}
                                            className={buttonStyles({
                                                variant: 'primary',
                                                size: 'lg',
                                                className: 'min-w-[15rem] shadow-[var(--shadow-md)]',
                                            })}
                                        >
                                            {t('business.info.bookButton', 'Записаться')}
                                        </Link>
                                        <Link
                                            href={promotions.length > 0 ? `/b/${biz.slug}/promotions` : `/b/${biz.slug}/booking`}
                                            className={buttonStyles({
                                                variant: 'outline',
                                                size: 'md',
                                                className: 'min-w-[15rem]',
                                            })}
                                        >
                                            {promotions.length > 0
                                                ? t('business.hero.secondaryCta', 'Смотреть акции')
                                                : t('business.hero.secondaryFallback', 'Выбрать филиал')}
                                        </Link>
                                    </div>
                                }
                            />

                            <div className="grid gap-3 sm:grid-cols-3">
                                <BusinessMetric
                                    value={branches.length}
                                    label={t('business.metrics.branches', 'активных филиалов')}
                                />
                                <BusinessMetric
                                    value={services.length}
                                    label={t('business.metrics.services', 'активных услуг')}
                                />
                                <BusinessMetric
                                    value={staff.length}
                                    label={t('business.metrics.staff', 'сотрудников в записи')}
                                />
                                <BusinessMetric
                                    value={promotions.length}
                                    label={t('business.metrics.promotions', 'акций и офферов')}
                                />
                            </div>
                        </div>

                        <Card variant="elevated" padding="lg" className="self-start">
                            <SectionHeader
                                title={t('business.trust.title', 'Почему можно идти дальше к записи')}
                                description={t(
                                    'business.trust.description',
                                    'Пользователь уже до booking flow видит структуру бизнеса, команду и основные сигналы доверия.',
                                )}
                            />
                            <div className="mt-4 grid gap-3">
                                <TrustPoint
                                    title={t('business.trust.point1Title', 'Филиалы видны заранее')}
                                    body={t(
                                        'business.trust.point1Body',
                                        'Можно понять географию бизнеса и не идти в booking flow вслепую.',
                                    )}
                                />
                                <TrustPoint
                                    title={t('business.trust.point2Title', 'Команда не скрыта')}
                                    body={t(
                                        'business.trust.point2Body',
                                        'Даже до выбора слота понятно, что в бизнесе есть реальные специалисты.',
                                    )}
                                />
                                <TrustPoint
                                    title={t('business.trust.point3Title', 'Акции и выгода прозрачны')}
                                    body={t(
                                        'business.trust.point3Body',
                                        'Если есть специальные предложения, они видны ещё до записи.',
                                    )}
                                />
                            </div>
                        </Card>
                    </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="space-y-6">
                        {branches.length > 0 ? (
                            <Card variant="elevated" padding="lg">
                                <SectionHeader
                                    title={t('business.info.branches', 'Филиалы')}
                                    description={t(
                                        'business.info.branchesDescription',
                                        'Здесь видно, где именно доступен бизнес и какие филиалы уже имеют рейтинг.',
                                    )}
                                    action={
                                        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
                                            {branches.length} {t('business.info.branchesCount', 'локаций')}
                                        </span>
                                    }
                                />
                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                    {branches.map((branch) => (
                                        <div
                                            key={branch.id}
                                            className={cardStyles({
                                                variant: 'default',
                                                padding: 'md',
                                                className:
                                                    'rounded-[24px] border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-[var(--shadow-xs)]',
                                            })}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="type-label text-[var(--text-primary)]">{formatName(branch.name)}</h3>
                                                    {branch.address ? (
                                                        <p className="type-caption mt-2 text-[var(--text-secondary)]">{branch.address}</p>
                                                    ) : null}
                                                </div>
                                                <RatingDisplay
                                                    score={branch.rating_score}
                                                    t={t}
                                                    variant="badge"
                                                    className="px-2 py-0.5"
                                                />
                                            </div>
                                            <p className="type-caption mt-4 text-[var(--text-muted)]">
                                                {t(
                                                    'business.info.branchHint',
                                                    'Филиал будет доступен в потоке записи при выборе удобной локации.',
                                                )}
                                            </p>
                                            {branch.directory_links && Object.values(branch.directory_links).some(Boolean) ? (
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {([
                                                        ['instagram', 'Instagram'],
                                                        ['two_gis', '2ГИС'],
                                                        ['google_maps', 'Google Карты'],
                                                        ['yandex_maps', 'Яндекс Карты'],
                                                    ] as const).map(([key, label]) => branch.directory_links?.[key] ? (
                                                        <a key={key} href={branch.directory_links[key] ?? '#'} target="_blank" rel="noreferrer" className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--accent-primary)] hover:bg-[var(--surface-emphasis)]">
                                                            {label}
                                                        </a>
                                                    ) : null)}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ) : null}

                        {services.length > 0 ? (
                            <Card variant="elevated" padding="lg" data-testid="services-section">
                                <SectionHeader
                                    title={t('business.info.services', 'Услуги')}
                                    description={t(
                                        'business.info.servicesDescription',
                                        'Активные услуги и их базовые условия видны до перехода к записи.',
                                    )}
                                    action={
                                        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
                                            {services.length} {t('business.info.servicesCount', 'услуг')}
                                        </span>
                                    }
                                />
                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                    {services.slice(0, 8).map((service) => {
                                        const branch = branches.find((branchItem) => branchItem.id === service.branch_id);

                                        return (
                                            <div
                                                key={service.id}
                                                className={cardStyles({
                                                    variant: 'outlined',
                                                    padding: 'md',
                                                    className: 'rounded-[24px] bg-[var(--surface-card)]',
                                                })}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <h3 className="type-label text-[var(--text-primary)]">
                                                            {getServiceName(service, locale)}
                                                        </h3>
                                                        {branch ? (
                                                            <p className="type-caption mt-1 text-[var(--text-secondary)]">
                                                                {formatName(branch.name)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <span className="type-caption shrink-0 rounded-full bg-[var(--surface-emphasis)] px-2.5 py-1 text-[var(--text-secondary)]">
                                                        {service.duration_min} {t('booking.duration.min', 'мин')}
                                                    </span>
                                                </div>
                                                <p className="type-body mt-4 font-semibold text-[var(--text-primary)]">
                                                    {formatServicePrice(service, locale, t)}
                                                </p>
                                            </div>
                                        );
                                    })}
                                    {services.length > 8 ? (
                                        <div
                                            className={cardStyles({
                                                variant: 'outlined',
                                                padding: 'md',
                                                className: 'flex min-h-[7rem] items-center justify-center rounded-[24px] border-dashed text-center text-[var(--text-muted)]',
                                            })}
                                        >
                                            <span className="type-caption">
                                                +{services.length - 8} {t('business.info.more', 'ещё')}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            </Card>
                        ) : null}

                        {staff.length > 0 ? (
                            <Card variant="elevated" padding="lg">
                                <SectionHeader
                                    title={t('business.info.staff', 'Команда')}
                                    description={t(
                                        'business.info.staffDescription',
                                        'Показываем сотрудников заранее, чтобы пользователь понимал, кого он сможет выбрать дальше.',
                                    )}
                                    action={
                                        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
                                            {staff.length} {t('business.info.staffCount', 'специалистов')}
                                        </span>
                                    }
                                />
                                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {staff.slice(0, 9).map((person) => {
                                        const branch = branches.find((branchItem) => branchItem.id === person.branch_id);

                                        return (
                                            <div
                                                key={person.id}
                                                className={cardStyles({
                                                    variant: 'default',
                                                    padding: 'md',
                                                    className: 'rounded-[24px] border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-[var(--shadow-xs)]',
                                                })}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {person.avatar_url ? (
                                                        <img
                                                            src={person.avatar_url}
                                                            alt={formatName(person.full_name)}
                                                            className="h-12 w-12 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="type-label flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-emphasis)] text-[var(--text-muted)]">
                                                            {formatName(person.full_name).charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="type-label truncate text-[var(--text-primary)]">
                                                            {formatName(person.full_name)}
                                                        </div>
                                                        {branch ? (
                                                            <p className="type-caption truncate text-[var(--text-secondary)]">
                                                                {formatName(branch.name)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex items-center justify-between gap-2">
                                                    <span className="type-caption text-[var(--text-muted)]">
                                                        {t('business.info.staffAvailable', 'Будет доступен в выборе специалиста')}
                                                    </span>
                                                    <RatingDisplay score={person.rating_score} t={t} variant="badge" className="px-1.5 py-0.5" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {staff.length > 9 ? (
                                        <div
                                            className={cardStyles({
                                                variant: 'outlined',
                                                padding: 'md',
                                                className:
                                                    'flex min-h-[9rem] items-center justify-center rounded-[24px] border-dashed text-center text-[var(--text-muted)]',
                                            })}
                                        >
                                            <span className="type-caption">
                                                +{staff.length - 9} {t('business.info.more', 'ещё')}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            </Card>
                        ) : null}

                        {promotions.length > 0 ? (
                            <Card variant="elevated" padding="lg" data-testid="promotions-section">
                                <SectionHeader
                                    title={t('business.info.promotions', 'Акции')}
                                    description={t(
                                        'business.info.promotionsDescription',
                                        'Спецпредложения видны до записи, поэтому пользователь понимает выгоду заранее.',
                                    )}
                                    action={
                                        <Link
                                            href={`/b/${biz.slug}/promotions`}
                                            className={buttonStyles({ variant: 'outline', size: 'sm' })}
                                        >
                                            {t('business.info.viewAllPromotions', 'Все акции')}
                                        </Link>
                                    }
                                />
                                <div className="mt-5 grid gap-3">
                                    {promotions.slice(0, 4).map((promotion) => {
                                        const branch = branches.find((branchItem) => branchItem.id === promotion.branch_id);
                                        const description = getPromotionDescription(promotion, t);

                                        return (
                                            <div
                                                key={promotion.id}
                                                className={cardStyles({
                                                    variant: 'glass',
                                                    padding: 'md',
                                                    className:
                                                        'rounded-[24px] border-[color:color-mix(in_srgb,var(--status-success)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--status-success)_8%,transparent)]',
                                                })}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--status-success-soft)] text-[var(--status-success)]">
                                                        %
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="type-body font-semibold text-[var(--text-primary)]">{description}</p>
                                                        {branch ? (
                                                            <p className="type-caption mt-2 text-[var(--text-secondary)]">
                                                                {formatName(branch.name)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        ) : null}
                    </div>

                    <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
                        <Card variant="elevated" padding="lg">
                            <SectionHeader
                                title={t('business.cta.title', 'Готовы перейти к записи')}
                                description={t(
                                    'business.cta.description',
                                    'Следующий шаг уже в booking flow: там выбираются филиал, услуга, сотрудник, дата и время.',
                                )}
                            />
                            <div className="mt-4 grid gap-3">
                                <BusinessMetric
                                    value={ratedBranches}
                                    label={t('business.metrics.ratedBranches', 'филиалов с рейтингом')}
                                />
                                <BusinessMetric
                                    value={ratedStaff}
                                    label={t('business.metrics.ratedStaff', 'сотрудников с рейтингом')}
                                />
                            </div>
                            <div className="mt-5 flex flex-col gap-2">
                                <Link
                                    href={`/b/${biz.slug}/booking`}
                                    onMouseEnter={handlePrefetchBookingData}
                                    onFocus={handlePrefetchBookingData}
                                    className={buttonStyles({
                                        variant: 'primary',
                                        size: 'lg',
                                        fullWidth: true,
                                    })}
                                >
                                    {t('business.info.bookButton', 'Записаться')}
                                </Link>
                                <Link
                                    href="/"
                                    className={buttonStyles({
                                        variant: 'ghost',
                                        size: 'md',
                                        fullWidth: true,
                                    })}
                                >
                                    {t('business.cta.backToCatalog', 'Вернуться в каталог')}
                                </Link>
                            </div>
                        </Card>
                    </aside>
                </section>
            </div>
        </main>
    );
}

function BusinessMetric({ value, label }: { value: number; label: string }) {
    return (
        <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_88%,transparent)] p-4 shadow-[var(--shadow-xs)]">
            <div className="type-metric text-[var(--text-primary)]">{value}</div>
            <p className="type-caption mt-2 text-[var(--text-muted)]">{label}</p>
        </div>
    );
}

function TrustPoint({ title, body }: { title: string; body: string }) {
    return (
        <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-4">
            <h3 className="type-label text-[var(--text-primary)]">{title}</h3>
            <p className="type-caption mt-2 text-[var(--text-secondary)]">{body}</p>
        </div>
    );
}

function getPromotionDescription(
    promotion: Promotion,
    t: (key: string, fallback?: string) => string,
) {
    const params = promotion.params || {};

    if (promotion.promotion_type === 'free_after_n_visits' && params.visit_count) {
        return t('booking.promotions.freeAfterN', 'Каждая {n}-я услуга бесплатно').replace('{n}', String(params.visit_count));
    }

    if (
        (promotion.promotion_type === 'birthday_discount' ||
            promotion.promotion_type === 'first_visit_discount' ||
            promotion.promotion_type === 'referral_discount_50') &&
        params.discount_percent
    ) {
        return t('booking.promotions.discountPercent', 'Скидка {percent}%').replace('{percent}', String(params.discount_percent));
    }

    return promotion.title_ru || t('business.info.promotionFallback', 'Доступно специальное предложение');
}

function formatServicePrice(
    service: Service,
    locale: string,
    t: (key: string, fallback?: string) => string,
): string {
    const from = typeof service.price_from === 'number' ? service.price_from : null;
    const to = typeof service.price_to === 'number' ? service.price_to : null;
    const formatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU');
    const currency = t('booking.currency', 'сом');

    if (from !== null && to !== null && from !== to) {
        return `${formatter.format(from)}–${formatter.format(to)} ${currency}`;
    }

    const value = from ?? to;
    return value === null
        ? t('business.info.priceOnRequest', 'Цена по запросу')
        : `${formatter.format(value)} ${currency}`;
}
