'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { slugifyBusinessName } from '@/lib/businessSlug';

type CategoryOption = {
    slug: string;
    name: string;
};

type Props = {
    bizId: string;
    categoryOptions: CategoryOption[];
    initial: {
        name: string;
        slug: string;
        categories: string[];
        address: string | null;
        phones: string[] | null;
        is_approved: boolean;
        created_at: string | null;
    };
};

export function BusinessCardEdit({ bizId, initial, categoryOptions }: Props) {
    const { locale, t } = useLanguage();
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [name, setName] = useState(initial.name);
    const [slug, setSlug] = useState(initial.slug);
    const [slugEdited, setSlugEdited] = useState(false);
    const [categories, setCategories] = useState(initial.categories);
    const [address, setAddress] = useState(initial.address ?? '');
    const [phonesText, setPhonesText] = useState((initial.phones ?? []).join('\n'));
    const [isApproved, setIsApproved] = useState(initial.is_approved);

    function reset() {
        setName(initial.name);
        setSlug(initial.slug);
        setSlugEdited(false);
        setCategories(initial.categories);
        setAddress(initial.address ?? '');
        setPhonesText((initial.phones ?? []).join('\n'));
        setIsApproved(initial.is_approved);
        setError(null);
    }

    function toggleCategory(categorySlug: string) {
        setCategories((current) =>
            current.includes(categorySlug)
                ? current.filter((value) => value !== categorySlug)
                : [...current, categorySlug],
        );
    }

    async function save() {
        setError(null);
        setSaving(true);
        try {
            const phones = phonesText
                .split('\n')
                .map((value) => value.trim())
                .filter(Boolean);
            const response = await fetch(`/admin/api/businesses/${bizId}/update`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: slugifyBusinessName(slug || name),
                    categories,
                    address: address.trim() || null,
                    phones: phones.length > 0 ? phones : null,
                    is_approved: isApproved,
                }),
            });
            const payload = (await response.json()) as { ok?: boolean; error?: string };
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || t('admin.businessDetail.error.save', 'Не удалось сохранить изменения'));
            }
            setEditing(false);
            router.refresh();
        } catch (saveError) {
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : t('admin.businessDetail.error.save', 'Не удалось сохранить изменения'),
            );
        } finally {
            setSaving(false);
        }
    }

    const categoryName = (slugValue: string) =>
        categoryOptions.find((option) => option.slug === slugValue)?.name ?? slugValue;

    return (
        <Card variant="elevated" padding="lg" className="space-y-5">
            <SectionHeader
                title={t('admin.businessDetail.profile.title', 'Профиль бизнеса')}
                description={t(
                    'admin.businessDetail.profile.description',
                    'Данные, которые определяют карточку бизнеса и его видимость для клиентов.',
                )}
                action={
                    editing ? (
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={saving}
                                onClick={() => {
                                    reset();
                                    setEditing(false);
                                }}
                            >
                                {t('admin.businessDetail.cancel', 'Отмена')}
                            </Button>
                            <Button type="button" size="sm" isLoading={saving} onClick={() => void save()}>
                                {t('admin.businessDetail.save', 'Сохранить')}
                            </Button>
                        </div>
                    ) : (
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                            {t('admin.businessDetail.edit', 'Редактировать')}
                        </Button>
                    )
                }
            />

            {error ? <AlertBanner variant="danger" message={error} compact /> : null}

            {editing ? (
                <div className="space-y-5 border-t border-[var(--border-subtle)] pt-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label={t('admin.businessDetail.name', 'Название')}
                            value={name}
                            maxLength={160}
                            required
                            onChange={(event) => {
                                const nextName = event.target.value;
                                setName(nextName);
                                if (!slugEdited) setSlug(slugifyBusinessName(nextName));
                            }}
                        />
                        <Input
                            label={t('admin.businessDetail.slug', 'URL-адрес')}
                            value={slug}
                            maxLength={80}
                            required
                            helperText={`/b/${slug || '...'}`}
                            onChange={(event) => {
                                setSlug(event.target.value);
                                setSlugEdited(true);
                            }}
                            onBlur={() => setSlug(slugifyBusinessName(slug || name))}
                        />
                        <Input
                            label={t('admin.businessDetail.address', 'Адрес')}
                            value={address}
                            onChange={(event) => setAddress(event.target.value)}
                            placeholder={t('admin.businessDetail.address.placeholder', 'Адрес основной локации')}
                        />
                        <div>
                            <label
                                htmlFor="business-phones"
                                className="type-caption mb-1.5 block font-medium text-[var(--text-secondary)]"
                            >
                                {t('admin.businessDetail.phones', 'Телефоны')}
                            </label>
                            <textarea
                                id="business-phones"
                                value={phonesText}
                                onChange={(event) => setPhonesText(event.target.value)}
                                rows={3}
                                placeholder={t('admin.businessDetail.phones.placeholder', 'Один номер на строку')}
                                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                            />
                        </div>
                    </div>

                    <fieldset className="space-y-3">
                        <legend className="type-label">
                            {t('admin.businessDetail.categories', 'Категории')}
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {categoryOptions.map((option) => {
                                const checked = categories.includes(option.slug);
                                return (
                                    <label
                                        key={option.slug}
                                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
                                            checked
                                                ? 'border-[var(--focus-ring)] bg-[var(--accent-soft)]'
                                                : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleCategory(option.slug)}
                                            className="h-4 w-4"
                                        />
                                        <span className="min-w-0">
                                            <span className="block font-medium">{option.name}</span>
                                            <span className="block truncate text-xs text-[var(--text-muted)]">{option.slug}</span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-default)] p-4">
                        <input
                            type="checkbox"
                            checked={isApproved}
                            onChange={(event) => setIsApproved(event.target.checked)}
                            className="mt-1 h-4 w-4"
                        />
                        <span>
                            <span className="type-label block">
                                {t('admin.businessDetail.approved', 'Показывать бизнес клиентам')}
                            </span>
                            <span className="type-caption mt-1 block text-[var(--text-muted)]">
                                {t(
                                    'admin.businessDetail.approved.helper',
                                    'Отключите, чтобы временно скрыть бизнес из публичного каталога.',
                                )}
                            </span>
                        </span>
                    </label>
                </div>
            ) : (
                <div className="space-y-5 border-t border-[var(--border-subtle)] pt-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <InfoBlock
                            label={t('admin.businessDetail.publicUrl', 'Публичная ссылка')}
                            value={`/b/${initial.slug}`}
                            mono
                        />
                        <InfoBlock
                            label={t('admin.businessDetail.created', 'Создан')}
                            value={
                                initial.created_at
                                    ? new Intl.DateTimeFormat(
                                          locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU',
                                          { dateStyle: 'long' },
                                      ).format(new Date(initial.created_at))
                                    : '—'
                            }
                        />
                        <InfoBlock
                            label={t('admin.businessDetail.address', 'Адрес')}
                            value={initial.address || t('admin.businessDetail.notSpecified', 'Не указан')}
                        />
                        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4">
                            <p className="type-caption text-[var(--text-muted)]">
                                {t('admin.businessDetail.phones', 'Телефоны')}
                            </p>
                            {(initial.phones?.length ?? 0) > 0 ? (
                                <div className="mt-2 space-y-1">
                                    {initial.phones!.map((phone) => (
                                        <a
                                            key={phone}
                                            href={`tel:${phone}`}
                                            className="block font-medium text-[var(--accent-primary)] hover:underline"
                                        >
                                            {phone}
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-2 font-medium">
                                    {t('admin.businessDetail.notSpecified', 'Не указаны')}
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <p className="type-caption mb-2 text-[var(--text-muted)]">
                            {t('admin.businessDetail.categories', 'Категории')}
                        </p>
                        {initial.categories.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {initial.categories.map((category) => (
                                    <Badge key={category} variant="accent">
                                        {categoryName(category)}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="type-body text-[var(--text-muted)]">
                                {t('admin.businessDetail.categories.empty', 'Категории не выбраны')}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}

function InfoBlock({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4">
            <p className="type-caption text-[var(--text-muted)]">{label}</p>
            <p className={`mt-2 break-words font-medium text-[var(--text-primary)] ${mono ? 'font-mono text-sm' : ''}`}>
                {value}
            </p>
        </div>
    );
}
