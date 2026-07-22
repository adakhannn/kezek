import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

import { ApplicationStatusButton } from './ApplicationStatusButton';

import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

type BusinessRegistrationApplication = {
    id: string;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    business_name: string | null;
    city: string | null;
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
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const [{ data: applications, error }, { data: categories, error: categoriesError }] = await Promise.all([
        admin
            .from('business_registration_applications')
            .select('id,contact_name,phone,email,business_name,city,category,comment,status,applicant_user_id,created_at,created_business_id,directory_links,prior_submission_count,risk_flags')
            .order('created_at', { ascending: false })
            .limit(200),
        admin.from('categories').select('slug,name_ru').eq('is_active', true),
    ]);

    if (error) return <div className="text-red-600">Ошибка: {error.message}</div>;
    if (categoriesError) return <div className="text-red-600">Ошибка категорий: {categoriesError.message}</div>;

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
                <h1 className="text-3xl font-bold">Заявки на регистрацию бизнеса</h1>
                <p className="mt-1 text-gray-500">Публичные заявки гостей и авторизованных пользователей.</p>
            </div>

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
                                    {knownCategoryName || rawCategory || 'Категория не указана'} · {application.city || 'Город не указан'}
                                </p>
                                {isProposedCategory ? (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                                            Предложена новая категория
                                        </span>
                                        <Link
                                            href={`/admin/categories/new?name=${encodeURIComponent(rawCategory)}`}
                                            className="text-xs font-medium text-[var(--accent-primary)] underline underline-offset-2"
                                        >
                                            Создать категорию
                                        </Link>
                                    </div>
                                ) : null}
                            </div>
                            <span className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1 text-xs font-medium">{application.status}</span>
                        </div>

                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <p><b>Контакт:</b> {application.contact_name}</p>
                            <p><b>Телефон:</b> {application.phone}</p>
                            <p><b>Email:</b> {application.email || '—'}</p>
                            <p><b>Аккаунт:</b> {application.applicant_user_id ? 'авторизован' : 'гость'}</p>
                        </div>

                        {application.comment ? <p className="rounded-lg bg-[var(--surface-emphasis)] p-3 text-sm">{application.comment}</p> : null}

                        {application.directory_links && Object.values(application.directory_links).some(Boolean) ? (
                            <div className="flex flex-wrap gap-2 text-sm">
                                {([
                                    ['instagram', 'Instagram'],
                                    ['two_gis', '2ГИС'],
                                    ['google_maps', 'Google Карты'],
                                    ['yandex_maps', 'Яндекс Карты'],
                                ] as const).map(([key, label]) => application.directory_links?.[key] ? (
                                    <a key={key} href={application.directory_links[key] ?? '#'} target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] underline">
                                        {label}
                                    </a>
                                ) : null)}
                            </div>
                        ) : null}

                        <p className="text-xs text-gray-500">{new Date(application.created_at).toLocaleString('ru-RU')}</p>

                        {application.prior_submission_count > 0 || application.risk_flags.length ? (
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-700 dark:text-amber-300">
                                    Предыдущих заявок: {application.prior_submission_count}
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
                                Открыть созданный бизнес
                            </Link>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                            <ApplicationStatusButton id={application.id} status="contacted" label="Связались" />
                            <ApplicationStatusButton
                                id={application.id}
                                status="approved"
                                label={application.created_business_id ? 'Одобрено' : 'Одобрить и создать бизнес'}
                                disabled={Boolean(application.created_business_id) || isProposedCategory}
                            />
                            <ApplicationStatusButton id={application.id} status="rejected" label="Отклонить" />
                            <ApplicationStatusButton id={application.id} status="rejected" label="Отклонить и блокировать 30 дней" blockDays={30} />
                        </div>
                        </Card>
                    );
                })}

                {!applications?.length ? <Card padding="lg">Заявок пока нет.</Card> : null}
            </div>
        </div>
    );
}
