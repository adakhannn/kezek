'use client';

import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';

import StaffForm from '../StaffForm';

import DangerActions from './DangerActions';
import StaffServicesEditor from './StaffServicesEditor';
import TransferStaffDialog from './TransferStaffDialog';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import { TZ } from '@/lib/time';

type Branch = { id: string; name: string; is_active: boolean };
type StaffData = {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    branch_id: string;
    is_active: boolean;
    percent_master: number | null;
    percent_salon: number | null;
    hourly_rate: number | null;
};
type Review = {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    booking_id: string;
    service_name: string | null;
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
};

type RatingWeights = {
    reviews: number;
    productivity: number;
    loyalty: number;
    discipline: number;
    windowDays: number;
};

function buildRatingAdvice(
    score: number | null,
    t: (key: string, fallback: string) => string,
) {
    if (score === null) {
        return t(
            'staff.rating.advice.noScore',
            'Рейтинг появится после накопления достаточного объема данных по сменам и отзывам.',
        );
    }
    if (score < 60) {
        return t(
            'staff.rating.advice.low',
            'Нужен фокус на базовых улучшениях: стабильность расписания, меньше опозданий и больше качественных отзывов.',
        );
    }
    if (score < 80) {
        return t(
            'staff.rating.advice.medium',
            'Рабочий уровень достигнут. Следующий шаг: укрепить повторные визиты и дисциплину смен.',
        );
    }
    return t(
        'staff.rating.advice.high',
        'Сильный результат. Удерживайте качество сервиса и стабильность операционной работы.',
    );
}

export default function StaffDetailPageClient({
    staff,
    branches,
    reviews,
    ratingScore,
    ratingWeights,
    explicitScheduling = false,
}: {
    staff: StaffData;
    explicitScheduling?: boolean;
    branches: Branch[];
    reviews: Review[];
    ratingScore?: number | null;
    ratingWeights?: RatingWeights | null;
}) {
    const { t } = useLanguage();

    const activeBranches = branches.filter((branch) => branch.is_active);
    const currentBranch = branches.find((branch) => branch.id === staff.branch_id);
    const effectiveRatingScore = typeof ratingScore === 'number' ? ratingScore : null;
    const masterPercent = Number(staff.percent_master ?? 60);
    const salonPercent = Number(staff.percent_salon ?? 40);
    const reviewAverage =
        reviews.length > 0
            ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
            : null;
    const latestReviewDate = reviews[0]?.created_at ?? null;

    return (
        <div className="mx-auto max-w-[var(--container-2xl)] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <section className="rounded-[30px] border border-[var(--border-subtle)] bg-gradient-to-r from-[var(--accent-primary)]/95 via-indigo-600 to-sky-600 p-5 text-white shadow-[var(--shadow-lg)] sm:p-6">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                            <Link
                                href="/dashboard/staff"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 transition hover:bg-white/20"
                                title={t('staff.detail.back.title', 'Назад к списку сотрудников')}
                                aria-label={t('staff.detail.back.title', 'Назад к списку сотрудников')}
                            >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </Link>
                            <div>
                                <h1 className="type-page-title text-white">{staff.full_name}</h1>
                                <p className="type-body mt-1 text-white/85">
                                    {currentBranch
                                        ? t('staff.detail.branch.current', 'Текущий филиал:') + ` ${currentBranch.name}`
                                        : t('staff.detail.branch.missing', 'Филиал не назначен')}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <StatusChip
                                    status={staff.is_active ? 'active' : 'inactive'}
                                    label={staff.is_active ? t('staff.detail.status.active', 'Активен') : t('staff.detail.status.inactive', 'Неактивен')}
                                    tone="solid"
                                />
                                {ratingWeights ? (
                                    <Badge variant="warning" tone="outline">
                                        {t('staff.rating.title.short', 'Рейтинг')}: {effectiveRatingScore !== null ? effectiveRatingScore.toFixed(1) : '—'}
                                    </Badge>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                            <Link
                                href={`/dashboard/staff/${staff.id}/schedule`}
                                className="type-label inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white transition hover:bg-white/20"
                            >
                                {t('staff.detail.nav.schedule', 'Расписание')}
                            </Link>
                            <Link
                                href={`/dashboard/staff/${staff.id}/slots`}
                                className="type-label inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white transition hover:bg-white/20"
                            >
                                {t('staff.detail.nav.slots', 'Слоты')}
                            </Link>
                            <Link
                                href={`/dashboard/staff/${staff.id}/finance`}
                                className="type-label inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white transition hover:bg-white/20"
                            >
                                {t('staff.detail.nav.finance', 'Финансы')}
                            </Link>
                            {activeBranches.length > 1 ? (
                                <TransferStaffDialog
                                    explicitScheduling={explicitScheduling}
                                    staffId={String(staff.id)}
                                    currentBranchId={String(staff.branch_id)}
                                    branches={activeBranches.map((branch) => ({ id: String(branch.id), name: String(branch.name) }))}
                                />
                            ) : (
                                <div className="type-caption inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white/80">
                                    {t('staff.detail.transfer.singleBranch', 'Перевод доступен при 2+ активных филиалах')}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                            <p className="type-caption text-white/75">{t('staff.detail.contact.email', 'Email')}</p>
                            <p className="type-label mt-1 text-white">{staff.email || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                            <p className="type-caption text-white/75">{t('staff.detail.contact.phone', 'Телефон')}</p>
                            <p className="type-label mt-1 text-white">{staff.phone || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                            <p className="type-caption text-white/75">{t('staff.detail.finance.share', 'Доли')}</p>
                            <p className="type-label mt-1 text-white">
                                {masterPercent}% / {salonPercent}%
                                {staff.hourly_rate ? ` • ${staff.hourly_rate}/h` : ''}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
                <Card variant="default" padding="md">
                    <p className="type-label text-[var(--text-secondary)]">{t('staff.detail.overview.reviews', 'Отзывы')}</p>
                    <p className="type-metric mt-2 text-[var(--text-primary)]">{reviews.length}</p>
                    <p className="type-caption mt-1 text-[var(--text-muted)]">
                        {reviewAverage !== null
                            ? `${t('staff.detail.overview.avgRating', 'Средний рейтинг')}: ${reviewAverage.toFixed(1)}`
                            : t('staff.detail.reviews.empty', 'Пока нет отзывов')}
                    </p>
                </Card>
                <Card variant="default" padding="md">
                    <p className="type-label text-[var(--text-secondary)]">{t('staff.detail.overview.finance', 'Финансовые условия')}</p>
                    <p className="type-metric mt-2 text-[var(--text-primary)]">{masterPercent}%</p>
                    <p className="type-caption mt-1 text-[var(--text-muted)]">
                        {t('staff.detail.overview.masterShare', 'Доля мастера')} • {salonPercent}% {t('staff.detail.overview.salonShare', 'доля салона')}
                    </p>
                </Card>
                <Card variant="default" padding="md">
                    <p className="type-label text-[var(--text-secondary)]">{t('staff.detail.overview.latestSignal', 'Последний сигнал')}</p>
                    <p className="type-body mt-2 text-[var(--text-primary)]">
                        {latestReviewDate
                            ? formatInTimeZone(new Date(latestReviewDate), TZ, 'dd.MM.yyyy HH:mm')
                            : t('staff.detail.overview.noSignals', 'Новых событий пока нет')}
                    </p>
                    <p className="type-caption mt-1 text-[var(--text-muted)]">
                        {t('staff.detail.overview.signalHint', 'Используйте расписание и финансы как следующую операционную точку.')}
                    </p>
                </Card>
            </section>

            <Card variant="default" padding="lg">
                <SectionHeader
                    title={t('staff.detail.sections.mainInfo.title', 'Профиль и условия')}
                    description={t('staff.detail.sections.mainInfo.desc', 'Контакты, активность, филиал и финансовые параметры сотрудника в одном блоке.')}
                />
                <div className="mt-5">
                    <StaffForm
                        initial={{
                            id: String(staff.id),
                            full_name: String(staff.full_name),
                            email: staff.email ?? null,
                            phone: staff.phone ?? null,
                            branch_id: String(staff.branch_id),
                            is_active: Boolean(staff.is_active),
                            percent_master: masterPercent,
                            percent_salon: salonPercent,
                            hourly_rate: staff.hourly_rate !== null && staff.hourly_rate !== undefined ? Number(staff.hourly_rate) : null,
                        }}
                        apiBase="/api/staff"
                    />
                </div>
            </Card>

            <Card variant="default" padding="lg">
                <SectionHeader
                    title={t('staff.detail.sections.competencies.title', 'Компетенции и услуги')}
                    description={t('staff.detail.sections.competencies.desc', 'Назначенные услуги сотрудника и покрытие по рабочим сценариям.')}
                />
                <div className="mt-5">
                    <StaffServicesEditor staffId={String(staff.id)} staffBranchId={String(staff.branch_id)} />
                </div>
            </Card>

            {ratingWeights ? (
                <Card variant="elevated" padding="lg" className="border-amber-200/80 dark:border-amber-900/40">
                    <SectionHeader
                        title={t('staff.rating.title', 'Рейтинг сотрудника в Kezek')}
                        description={t('staff.rating.subtitle', 'Общий балл формируется из отзывов, продуктивности, лояльности и дисциплины.')}
                        badge={<Badge variant="warning">{t('staff.rating.window', 'Окно')}: {ratingWeights.windowDays}</Badge>}
                    />
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <p className="type-caption text-[var(--text-muted)]">{buildRatingAdvice(effectiveRatingScore, t)}</p>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="success">{t('dashboard.rating.factor.reviews', 'Отзывы')}: {ratingWeights.reviews}%</Badge>
                                <Badge variant="accent">{t('dashboard.rating.factor.productivity', 'Продуктивность')}: {ratingWeights.productivity}%</Badge>
                                <Badge variant="info">{t('dashboard.rating.factor.loyalty', 'Лояльность')}: {ratingWeights.loyalty}%</Badge>
                                <Badge variant="danger">{t('dashboard.rating.factor.discipline', 'Дисциплина')}: {ratingWeights.discipline}%</Badge>
                            </div>
                        </div>
                        <div className="flex items-center justify-start md:justify-end">
                            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3">
                                <p className="type-caption text-[var(--text-secondary)]">{t('staff.rating.scoreLabel', 'Текущий балл')}</p>
                                <p className="type-metric mt-1 text-[var(--text-primary)]">
                                    {effectiveRatingScore !== null ? effectiveRatingScore.toFixed(1) : '—'}
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            ) : null}

            <Card variant="default" padding="lg">
                <SectionHeader
                    title={t('staff.detail.sections.reviews.title', 'Отзывы')}
                    description={t('staff.detail.sections.reviews.desc', 'Последние оценки клиентов с контекстом услуги, времени и комментариями.')}
                    badge={
                        <Badge variant="neutral">
                            {reviews.length} {t('staff.detail.reviews.count', 'отзывов')}
                        </Badge>
                    }
                />

                {reviews.length === 0 ? (
                    <div className="py-10 text-center">
                        <p className="type-body text-[var(--text-muted)]">
                            {t('staff.detail.reviews.empty', 'Пока нет отзывов')}
                        </p>
                    </div>
                ) : (
                    <div className="mt-5 space-y-3">
                        {reviews.map((review) => {
                            const bookingDate = formatInTimeZone(new Date(review.start_at), TZ, 'dd.MM.yyyy HH:mm');
                            return (
                                <div
                                    key={review.id}
                                    className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4"
                                >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="warning" tone="soft">
                                                    {review.rating}/5
                                                </Badge>
                                                <p className="type-caption text-[var(--text-muted)]">{bookingDate}</p>
                                            </div>
                                            <p className="type-label mt-2 text-[var(--text-primary)]">
                                                {review.service_name || t('staff.detail.reviews.serviceMissing', 'Услуга не указана')}
                                            </p>
                                            <p className="type-caption mt-1 text-[var(--text-secondary)]">
                                                {review.client_name || review.client_phone || t('staff.detail.reviews.client', 'Клиент')}
                                            </p>
                                        </div>
                                    </div>
                                    {review.comment ? (
                                        <p className="type-body mt-3 border-t border-[var(--border-subtle)] pt-3 text-[var(--text-secondary)]">
                                            {review.comment}
                                        </p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            <Card variant="outlined" padding="md">
                <p className="type-caption text-[var(--text-muted)]">
                    {t('staff.detail.transfer.note', 'Временные переводы между филиалами задаются в разделе')}{' '}
                    <Link href={`/dashboard/staff/${staff.id}/schedule`} className="font-medium text-[var(--accent-primary)] hover:underline">
                        {t('staff.detail.transfer.scheduleLink', '«Расписание»')}
                    </Link>
                    .
                </p>
            </Card>

            <DangerActions staffId={String(staff.id)} allowPermanentDelete={!explicitScheduling} />
        </div>
    );
}
