import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

import { ApplicationStatusButton } from './ApplicationStatusButton';

import { getServerLocale, getT, type I18nKey } from '@/app/_components/i18n/server';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

type BusinessRegistrationApplication = {
    id: string;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    business_name: string | null;
    category: string | null;
    comment: string | null;
    status: string | null;
    applicant_user_id: string | null;
    created_at: string;
    created_business_id: string | null;
    directory_links: Record<string, string | null> | null;
    prior_submission_count: number;
    risk_flags: string[];
};

export default async function BusinessApplicationsPage() {
    const locale = await getServerLocale();
    const t = getT(locale);
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const [{ data: applications, error }, { data: categories, error: categoriesError }] = await Promise.all([
        admin
            .from('business_registration_applications')
            .select('id,contact_name,phone,email,business_name,category,comment,status,applicant_user_id,created_at,created_business_id,directory_links,prior_submission_count,risk_flags')
            .order('created_at', { ascending: false })
            .limit(200),
        admin.from('categories').select('slug,name_ru').eq('is_active', true),
    ]);

    if (error) return <div className="text-red-600">{t('admin.businessApplications.error.load')}: {error.message}</div>;
    if (categoriesError) return <div className="text-red-600">{t('admin.businessApplications.error.categories')}: {categoriesError.message}</div>;

    const categoryNames = new Map<string, string>();
    (categories ?? []).forEach((category) => {
        const slug = typeof category.slug === 'string' ? category.slug.trim() : '';
        const name = typeof category.name_ru === 'string' ? category.name_ru.trim() : '';
        if (!slug || !name) return;
        categoryNames.set(slug.toLowerCase(), name);
        categoryNames.set(name.toLowerCase(), name);
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.businessApplications.title')}</h1>
                <p className="mt-1 text-gray-500">{t('admin.businessApplications.subtitle')}</p>
            </div>

            <Card variant="outlined" padding="md">
                <div className="mb-4">
                    <h2 className="font-semibold text-[var(--text-primary)]">{t('admin.businessApplications.actions.title')}</h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{t('admin.businessApplications.actions.subtitle')}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <ActionExplanation
                        step="1"
                        title={t('admin.businessApplications.actions.approve.title')}
                        description={t('admin.businessApplications.actions.approve.description')}
                        tone="success"
                    />
                    <ActionExplanation
                        step="2"
                        title={t('admin.businessApplications.actions.reject.title')}
                        description={t('admin.businessApplications.actions.reject.description')}
                    />
                    <ActionExplanation
                        step="3"
                        title={t('admin.businessApplications.actions.block.title')}
                        description={t('admin.businessApplications.actions.block.description')}
                        tone="danger"
                    />
                </div>
            </Card>

            <div className="grid gap-4">
                {((applications ?? []) as BusinessRegistrationApplication[]).map((application) => {
                    const rawCategory = application.category?.trim() ?? '';
                    const knownCategoryName = rawCategory ? categoryNames.get(rawCategory.toLowerCase()) : null;
                    const isProposedCategory = Boolean(rawCategory && !knownCategoryName);

                    return (
                        <Card key={application.id} variant="outlined" padding="md" className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">{application.business_name}</h2>
                                <p className="text-sm text-gray-500">
                                    {knownCategoryName || rawCategory || t('admin.businessApplications.categoryMissing')}
                                </p>
                                {isProposedCategory ? (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                                            {t('admin.businessApplications.proposedCategory')}
                                        </span>
                                        <Link
                                            href={`/admin/categories/new?name=${encodeURIComponent(rawCategory)}`}
                                            className="text-xs font-medium text-[var(--accent-primary)] underline underline-offset-2"
                                        >
                                            {t('admin.businessApplications.createCategory')}
                                        </Link>
                                    </div>
                                ) : null}
                            </div>
                            <span className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1 text-xs font-medium">
                                {getApplicationStatusLabel(application.status, t)}
                            </span>
                        </div>

                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <p><b>{t('admin.businessApplications.contact')}:</b> {application.contact_name}</p>
                            <p><b>{t('admin.businessApplications.phone')}:</b> {application.phone}</p>
                            <p><b>Email:</b> {application.email || '—'}</p>
                            <p>
                                <b>{t('admin.businessApplications.account')}:</b>{' '}
                                {application.applicant_user_id
                                    ? t('admin.businessApplications.account.authenticated')
                                    : t('admin.businessApplications.account.guest')}
                            </p>
                        </div>

                        {application.comment ? <p className="rounded-lg bg-[var(--surface-emphasis)] p-3 text-sm">{application.comment}</p> : null}

                        {application.directory_links && Object.values(application.directory_links).some(Boolean) ? (
                            <div className="flex flex-wrap gap-2 text-sm">
                                {([
                                    ['instagram', 'Instagram'],
                                    ['two_gis', '2ГИС'],
                                    ['google_maps', t('admin.businessApplications.googleMaps')],
                                    ['yandex_maps', t('admin.businessApplications.yandexMaps')],
                                ] as const).map(([key, label]) => application.directory_links?.[key] ? (
                                    <a key={key} href={application.directory_links[key] ?? '#'} target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] underline">
                                        {label}
                                    </a>
                                ) : null)}
                            </div>
                        ) : null}

                        <p className="text-xs text-gray-500">
                            {new Date(application.created_at).toLocaleString(
                                locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU'
                            )}
                        </p>

                        {application.prior_submission_count > 0 || application.risk_flags.length ? (
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-700 dark:text-amber-300">
                                    {t('admin.businessApplications.previousCount').replace('{count}', String(application.prior_submission_count))}
                                </span>
                                {application.risk_flags.map((flag) => (
                                    <span key={flag} className="rounded-full bg-red-500/10 px-3 py-1 text-red-700 dark:text-red-300">
                                        {flag}
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        {application.created_business_id ? (
                            <Link
                                href={`/admin/businesses/${application.created_business_id}`}
                                className="inline-flex w-fit items-center rounded-lg border border-emerald-500/40 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                            >
                                {t('admin.businessApplications.openBusiness')}
                            </Link>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                            <ApplicationStatusButton
                                id={application.id}
                                status="approved"
                                label={application.created_business_id
                                    ? t('admin.businessApplications.button.approved')
                                    : t('admin.businessApplications.button.approve')}
                                disabled={Boolean(application.created_business_id) || isProposedCategory}
                                variant="primary"
                            />
                            <ApplicationStatusButton
                                id={application.id}
                                status="rejected"
                                label={t('admin.businessApplications.button.reject')}
                            />
                            <ApplicationStatusButton
                                id={application.id}
                                status="rejected"
                                label={t('admin.businessApplications.button.rejectBlock')}
                                blockDays={30}
                                variant="danger"
                            />
                        </div>
                        {isProposedCategory ? (
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                {t('admin.businessApplications.approvalBlockedByCategory')}
                            </p>
                        ) : null}
                        </Card>
                    );
                })}

                {!applications?.length ? <Card padding="lg">{t('admin.businessApplications.empty')}</Card> : null}
            </div>
        </div>
    );
}

function ActionExplanation({
    step,
    title,
    description,
    tone = 'neutral',
}: {
    step: string;
    title: string;
    description: string;
    tone?: 'neutral' | 'success' | 'danger';
}) {
    const toneClasses = {
        neutral: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
        success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        danger: 'bg-red-500/15 text-red-700 dark:text-red-300',
    };

    return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-emphasis)]/55 p-3">
            <div className="flex items-start gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${toneClasses[tone]}`}>
                    {step}
                </span>
                <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{description}</p>
                </div>
            </div>
        </div>
    );
}

function getApplicationStatusLabel(
    status: string | null,
    t: <K extends I18nKey>(key: K, fallback?: string) => string,
) {
    const keys: Record<string, I18nKey> = {
        new: 'admin.businessApplications.status.new',
        contacted: 'admin.businessApplications.status.contacted',
        approved: 'admin.businessApplications.status.approved',
        rejected: 'admin.businessApplications.status.rejected',
    };
    return status && keys[status] ? t(keys[status]) : status || '—';
}
