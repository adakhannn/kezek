'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { slugifyBusinessName } from '@/lib/businessSlug';

export type ManualBusinessCategory = {
    id: string;
    slug: string;
    name_ru: string;
};

type Duplicate = {
    id: string;
    name: string;
    slug: string;
    phones: string[] | null;
    matchedBy: Array<'name' | 'phone'>;
};

type ApiResponse = {
    ok?: boolean;
    id?: string;
    code?: string;
    error?: string;
    duplicates?: Duplicate[];
};

export function ManualBusinessCreateForm({
    categories,
    categoriesLoadError,
}: {
    categories: ManualBusinessCategory[];
    categoriesLoadError: string | null;
}) {
    const { t } = useLanguage();
    const router = useRouter();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugEdited, setSlugEdited] = useState(false);
    const [phone, setPhone] = useState('');
    const [branchLimit, setBranchLimit] = useState(1);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [reason, setReason] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicates, setDuplicates] = useState<Duplicate[]>([]);

    const visibleCategories = useMemo(() => {
        const query = categorySearch.trim().toLocaleLowerCase();
        if (!query) return categories;
        return categories.filter(
            (category) =>
                category.name_ru.toLocaleLowerCase().includes(query) ||
                category.slug.toLocaleLowerCase().includes(query),
        );
    }, [categories, categorySearch]);

    function updateName(nextName: string) {
        setName(nextName);
        if (!slugEdited) setSlug(nextName.trim() ? slugifyBusinessName(nextName) : '');
        setDuplicates([]);
    }

    function toggleCategory(category: string) {
        setSelectedCategories((current) =>
            current.includes(category)
                ? current.filter((value) => value !== category)
                : [...current, category],
        );
    }

    function localizedError(code?: string, fallback?: string): string {
        const keyByCode: Record<string, string> = {
            invalid_name: 'admin.manualBusiness.error.name',
            invalid_slug: 'admin.manualBusiness.error.slug',
            invalid_phone: 'admin.manualBusiness.error.phone',
            categories_required: 'admin.manualBusiness.error.categories',
            invalid_categories: 'admin.manualBusiness.error.categories',
            invalid_branch_limit: 'admin.manualBusiness.error.branchLimit',
            invalid_reason: 'admin.manualBusiness.error.reason',
            acknowledgement_required: 'admin.manualBusiness.error.acknowledgement',
            slug_taken: 'admin.manualBusiness.error.slugTaken',
            possible_duplicate: 'admin.manualBusiness.duplicates.description',
            audit_failed: 'admin.manualBusiness.error.audit',
        };
        const key = code ? keyByCode[code] : undefined;
        return key
            ? t(key, fallback)
            : fallback || t('admin.manualBusiness.error.generic', 'Не удалось создать бизнес');
    }

    async function submit(duplicateOverride = false) {
        setLoading(true);
        setError(null);
        if (!duplicateOverride) setDuplicates([]);

        try {
            const response = await fetch('/admin/api/businesses/create', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    name,
                    slug,
                    phone,
                    categories: selectedCategories,
                    branch_limit: branchLimit,
                    reason,
                    acknowledge_manual: acknowledged,
                    duplicate_override: duplicateOverride,
                }),
            });
            const payload = (await response.json()) as ApiResponse;

            if (response.status === 409 && payload.code === 'possible_duplicate') {
                setDuplicates(payload.duplicates ?? []);
                setError(localizedError(payload.code, payload.error));
                return;
            }
            if (!response.ok || !payload.ok || !payload.id) {
                throw new Error(localizedError(payload.code, payload.error));
            }

            router.push(`/admin/businesses/${payload.id}`);
            router.refresh();
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : t('admin.manualBusiness.error.generic', 'Не удалось создать бизнес'),
            );
        } finally {
            setLoading(false);
        }
    }

    const canSubmit =
        name.trim().length >= 2 &&
        slug.trim().length > 0 &&
        selectedCategories.length > 0 &&
        reason.trim().length >= 10 &&
        acknowledged;

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <PageHeader
                title={t('admin.manualBusiness.title', 'Создать бизнес вручную')}
                description={t(
                    'admin.manualBusiness.subtitle',
                    'Служебный сценарий для миграций, восстановления и исключительных случаев.',
                )}
                actions={
                    <Link href="/admin/businesses">
                        <Button variant="outline">
                            {t('admin.manualBusiness.back', 'К списку бизнесов')}
                        </Button>
                    </Link>
                }
            />

            <AlertBanner
                variant="warning"
                title={t('admin.manualBusiness.warning.title', 'Этот путь обходит публичную заявку')}
                message={t(
                    'admin.manualBusiness.warning.description',
                    'Используйте его только когда заявитель не может пройти обычный процесс. Бизнес будет одобрен сразу, но останется без владельца до отдельного назначения.',
                )}
            />

            {categoriesLoadError ? (
                <AlertBanner
                    variant="danger"
                    title={t('admin.manualBusiness.error.categoriesLoad', 'Категории не загрузились')}
                    message={categoriesLoadError}
                />
            ) : null}

            <Card padding="lg" variant="elevated">
                <form
                    className="space-y-7"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submit(false);
                    }}
                >
                    <section className="space-y-4">
                        <div>
                            <h2 className="type-section-title">
                                {t('admin.manualBusiness.details.title', 'Данные бизнеса')}
                            </h2>
                            <p className="type-caption mt-1 text-[var(--text-muted)]">
                                {t(
                                    'admin.manualBusiness.details.description',
                                    'Контакт нужен для поиска возможных дублей. Владелец назначается отдельно.',
                                )}
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label={t('admin.manualBusiness.name', 'Название бизнеса')}
                                value={name}
                                onChange={(event) => updateName(event.target.value)}
                                maxLength={160}
                                required
                            />
                            <Input
                                label={t('admin.manualBusiness.phone', 'Контактный телефон')}
                                value={phone}
                                onChange={(event) => {
                                    setPhone(event.target.value);
                                    setDuplicates([]);
                                }}
                                placeholder="+996..."
                                helperText={t(
                                    'admin.manualBusiness.phone.helper',
                                    'Необязательно. Используется для проверки дублей.',
                                )}
                                inputMode="tel"
                            />
                            <Input
                                label={t('admin.manualBusiness.slug', 'URL-адрес')}
                                value={slug}
                                onChange={(event) => {
                                    setSlug(event.target.value);
                                    setSlugEdited(true);
                                }}
                                onBlur={() => setSlug(slugifyBusinessName(slug || name))}
                                maxLength={80}
                                required
                                helperText={`/b/${slug || '...'}`}
                            />
                            <Input
                                label={t('admin.manualBusiness.branchLimit', 'Лимит филиалов')}
                                type="number"
                                min={1}
                                max={1000}
                                value={String(branchLimit)}
                                onChange={(event) =>
                                    setBranchLimit(
                                        Math.max(1, Math.min(1000, Number.parseInt(event.target.value || '1', 10))),
                                    )
                                }
                                required
                            />
                        </div>
                    </section>

                    <section className="space-y-4 border-t border-[var(--border-subtle)] pt-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="type-section-title">
                                    {t('admin.manualBusiness.categories.title', 'Категории')}
                                </h2>
                                <p className="type-caption mt-1 text-[var(--text-muted)]">
                                    {t('admin.manualBusiness.categories.description', 'Выберите минимум одну активную категорию.')}
                                </p>
                            </div>
                            <Input
                                aria-label={t('admin.manualBusiness.categories.search', 'Поиск категорий')}
                                placeholder={t('admin.manualBusiness.categories.search', 'Поиск категорий')}
                                value={categorySearch}
                                onChange={(event) => setCategorySearch(event.target.value)}
                                containerClassName="sm:max-w-xs"
                                fieldSize="sm"
                            />
                        </div>

                        <div className="grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-[var(--border-default)] p-3 sm:grid-cols-2">
                            {visibleCategories.map((category) => {
                                const checked = selectedCategories.includes(category.slug);
                                return (
                                    <label
                                        key={category.id}
                                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
                                            checked
                                                ? 'border-[var(--focus-ring)] bg-[var(--accent-soft)]'
                                                : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleCategory(category.slug)}
                                            className="h-4 w-4"
                                        />
                                        <span className="min-w-0">
                                            <span className="block font-medium text-[var(--text-primary)]">{category.name_ru}</span>
                                            <span className="block truncate text-xs text-[var(--text-muted)]">{category.slug}</span>
                                        </span>
                                    </label>
                                );
                            })}
                            {visibleCategories.length === 0 ? (
                                <p className="type-caption p-3 text-[var(--text-muted)]">
                                    {t('admin.manualBusiness.categories.empty', 'Категории не найдены')}
                                </p>
                            ) : null}
                        </div>
                    </section>

                    <section className="space-y-4 border-t border-[var(--border-subtle)] pt-6">
                        <div>
                            <label htmlFor="manual-business-reason" className="type-caption mb-1.5 block font-medium text-[var(--text-secondary)]">
                                {t('admin.manualBusiness.reason', 'Причина ручного создания')}
                            </label>
                            <textarea
                                id="manual-business-reason"
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                rows={4}
                                minLength={10}
                                maxLength={1000}
                                required
                                placeholder={t(
                                    'admin.manualBusiness.reason.placeholder',
                                    'Например: перенос существующего клиента из прежней системы...',
                                )}
                                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                            />
                            <p className="type-caption mt-1.5 text-[var(--text-muted)]">
                                {t(
                                    'admin.manualBusiness.reason.helper',
                                    'Причина сохраняется в служебном журнале и не показывается клиентам.',
                                )}
                            </p>
                        </div>

                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-default)] p-4">
                            <input
                                type="checkbox"
                                checked={acknowledged}
                                onChange={(event) => setAcknowledged(event.target.checked)}
                                className="mt-1 h-4 w-4"
                            />
                            <span className="type-body">
                                {t(
                                    'admin.manualBusiness.acknowledgement',
                                    'Я проверил, что публичная заявка для этого случая не подходит, и понимаю, что владелец не будет назначен автоматически.',
                                )}
                            </span>
                        </label>
                    </section>

                    {duplicates.length > 0 ? (
                        <section className="space-y-3 rounded-xl border border-[var(--status-warning)] bg-[var(--status-warning-soft)] p-4">
                            <div>
                                <h2 className="type-label">
                                    {t('admin.manualBusiness.duplicates.title', 'Найдены похожие бизнесы')}
                                </h2>
                                <p className="type-caption mt-1">
                                    {t(
                                        'admin.manualBusiness.duplicates.description',
                                        'Проверьте карточки. Если это не дубли, создание можно подтвердить повторно.',
                                    )}
                                </p>
                            </div>
                            <div className="space-y-2">
                                {duplicates.map((duplicate) => (
                                    <Link
                                        key={duplicate.id}
                                        href={`/admin/businesses/${duplicate.id}`}
                                        target="_blank"
                                        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 hover:border-[var(--border-strong)]"
                                    >
                                        <span>
                                            <span className="block font-medium">{duplicate.name}</span>
                                            <span className="block text-xs text-[var(--text-muted)]">{duplicate.slug}</span>
                                        </span>
                                        <span className="text-xs text-[var(--text-muted)]">
                                            {duplicate.matchedBy.join(', ')}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                isLoading={loading}
                                onClick={() => void submit(true)}
                            >
                                {t('admin.manualBusiness.duplicates.override', 'Проверил — всё равно создать')}
                            </Button>
                        </section>
                    ) : null}

                    {error ? (
                        <AlertBanner
                            variant={duplicates.length > 0 ? 'warning' : 'danger'}
                            title={t('admin.manualBusiness.error.title', 'Создание не выполнено')}
                            message={error}
                        />
                    ) : null}

                    <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:justify-end">
                        <Link href="/admin/businesses">
                            <Button type="button" variant="ghost" className="w-full sm:w-auto">
                                {t('admin.manualBusiness.cancel', 'Отмена')}
                            </Button>
                        </Link>
                        <Button
                            type="submit"
                            isLoading={loading}
                            disabled={!canSubmit || categoriesLoadError !== null}
                            className="w-full sm:w-auto"
                        >
                            {t('admin.manualBusiness.submit', 'Создать вручную')}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
