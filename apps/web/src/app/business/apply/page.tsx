import Link from 'next/link';

import { BusinessApplicationForm, type BusinessCategoryOption } from './BusinessApplicationForm';

import { Card } from '@/components/ui/Card';
import { buttonStyles } from '@/components/ui/buttonStyles';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function BusinessApplicationPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    let categories: BusinessCategoryOption[] = [];

    if (user) {
        const admin = createSupabaseAdminClient();
        const { data } = await admin
            .from('categories')
            .select('slug,name_ru')
            .eq('is_active', true)
            .order('name_ru', { ascending: true });

        categories = (data ?? []).flatMap((category) => (
            typeof category.slug === 'string' && typeof category.name_ru === 'string'
                ? [{ slug: category.slug, name: category.name_ru }]
                : []
        ));
    }

    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
            <div className="mb-6 text-center">
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">Подключить бизнес к Kezek</h1>
                <p className="mt-2 text-[var(--text-secondary)]">
                    {user
                        ? 'Заполните заявку — после проверки бизнес будет привязан к вашему аккаунту.'
                        : 'Сначала войдите в Kezek, чтобы заявка и созданный бизнес были привязаны именно к вам.'}
                </p>
            </div>

            {user ? <BusinessApplicationForm categories={categories} /> : <AuthenticationGate />}
        </main>
    );
}

function AuthenticationGate() {
    return (
        <Card variant="elevated" padding="lg" className="overflow-hidden">
            <div className="mx-auto max-w-xl text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-emphasis)] text-[var(--accent-primary)]">
                    <svg className="h-7 w-7" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h2 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">Войдите перед отправкой заявки</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Авторизация займёт меньше минуты. Она нужна, чтобы после одобрения вы автоматически получили доступ владельца к бизнесу.
                </p>

                <ul className="my-6 grid gap-3 text-left md:grid-cols-3">
                    {[
                        {
                            title: 'Заявка — ваша',
                            description: 'Сохраним её в аккаунте',
                        },
                        {
                            title: 'Статус сохранится',
                            description: 'Можно проверить позже',
                        },
                        {
                            title: 'Доступ автоматически',
                            description: 'Сразу после одобрения',
                        },
                    ].map((item) => (
                        <li
                            key={item.title}
                            className="flex min-w-0 items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-emphasis)_72%,transparent)] p-3.5"
                        >
                            <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--status-success)_14%,transparent)] text-[var(--status-success)]"
                                aria-hidden="true"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M5 13l4 4L19 7" />
                                </svg>
                            </span>
                            <span className="min-w-0 pt-0.5">
                                <span className="block text-sm font-semibold leading-5 text-[var(--text-primary)]">
                                    {item.title}
                                </span>
                                <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">
                                    {item.description}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>

                <Link
                    href="/auth/sign-in?redirect=/business/apply"
                    className={buttonStyles({ fullWidth: true })}
                >
                    Войти и продолжить
                </Link>
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                    После входа вы автоматически вернётесь к этой форме.
                </p>
            </div>
        </Card>
    );
}
