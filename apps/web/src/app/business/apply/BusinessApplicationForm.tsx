'use client';

import { useState } from 'react';

import { useLanguage, type I18nKey } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

export type BusinessCategoryOption = {
    slug: string;
    name: string;
};

const PROPOSE_CATEGORY_VALUE = '__propose_category__';

const APPLICATION_ERROR_KEYS: Partial<Record<string, I18nKey>> = {
    auth_required: 'business.apply.error.authRequired',
    invalid_request: 'business.apply.error.invalidRequest',
    required_fields: 'business.apply.error.requiredFields',
    invalid_email: 'business.apply.error.invalidEmail',
    service_unavailable: 'business.apply.error.serviceUnavailable',
    business_exists: 'business.apply.error.businessExists',
    recent_duplicate: 'business.apply.error.recentDuplicate',
    pending_duplicate: 'business.apply.error.pendingDuplicate',
    blocked: 'business.apply.error.blocked',
    active_limit: 'business.apply.error.activeLimit',
    monthly_limit: 'business.apply.error.monthlyLimit',
    cooldown_24h: 'business.apply.error.cooldown24h',
};

const emptyForm = {
    contact_name: '',
    phone: '',
    email: '',
    business_name: '',
    comment: '',
    website: '',
    instagram: '',
    two_gis: '',
    google_maps: '',
    yandex_maps: '',
};

export type BusinessApplicationInitialValues = Partial<Pick<
    typeof emptyForm,
    'contact_name' | 'phone' | 'email'
>>;

function createInitialForm(initialValues?: BusinessApplicationInitialValues) {
    return {
        ...emptyForm,
        ...initialValues,
    };
}

export function BusinessApplicationForm({
    categories,
    initialValues,
}: {
    categories: BusinessCategoryOption[];
    initialValues?: BusinessApplicationInitialValues;
}) {
    const { t } = useLanguage();
    const [form, setForm] = useState(() => createInitialForm(initialValues));
    const [categoryChoice, setCategoryChoice] = useState(categories.length ? '' : PROPOSE_CATEGORY_VALUE);
    const [proposedCategory, setProposedCategory] = useState('');
    const [sending, setSending] = useState(false);
    const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
    const [sent, setSent] = useState(false);

    function field(name: keyof typeof emptyForm) {
        return {
            value: form[name],
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                setForm((current) => ({ ...current, [name]: event.target.value }));
            },
        };
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setErrorKey(null);

        const category = categoryChoice === PROPOSE_CATEGORY_VALUE
            ? proposedCategory.trim()
            : categoryChoice;
        if (!category) {
            setErrorKey(categoryChoice === PROPOSE_CATEGORY_VALUE
                ? 'business.apply.error.proposedCategoryRequired'
                : 'business.apply.error.categoryRequired');
            return;
        }

        setSending(true);
        try {
            const response = await fetch('/api/business-applications', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ ...form, category }),
            });
            const payload = (await response.json()) as { ok?: boolean; code?: string };
            if (!response.ok || !payload.ok) {
                setErrorKey(
                    (payload.code ? APPLICATION_ERROR_KEYS[payload.code] : undefined)
                    ?? 'business.apply.error.submit',
                );
                return;
            }
            setSent(true);
            setForm(createInitialForm(initialValues));
            setCategoryChoice(categories.length ? '' : PROPOSE_CATEGORY_VALUE);
            setProposedCategory('');
        } catch {
            setErrorKey('business.apply.error.submit');
        } finally {
            setSending(false);
        }
    }

    return (
        <Card variant="elevated" padding="lg">
            {sent ? (
                <AlertBanner
                    variant="success"
                    title={t('business.apply.success.title')}
                    message={t('business.apply.success.message')}
                />
            ) : (
                <form onSubmit={submit} className="space-y-5">
                    {errorKey ? (
                        <AlertBanner
                            variant="danger"
                            message={t(errorKey)}
                            onClose={() => setErrorKey(null)}
                        />
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label={t('business.apply.field.contactName')} required {...field('contact_name')} />
                        <Input
                            label={t('business.apply.field.phone')}
                            type="tel"
                            required
                            placeholder={t('business.apply.field.phonePlaceholder')}
                            helperText={t('business.apply.field.phoneHint')}
                            {...field('phone')}
                        />
                        <Input label="Email" type="email" required {...field('email')} />
                        <Input label={t('business.apply.field.businessName')} required {...field('business_name')} />
                        <Select
                            id="business-category"
                            label={t('business.apply.field.category')}
                            required
                            value={categoryChoice}
                            onChange={(event) => {
                                setCategoryChoice(event.target.value);
                                setErrorKey(null);
                            }}
                            helperText={t('business.apply.category.helper')}
                        >
                            <option value="" disabled>{t('business.apply.category.placeholder')}</option>
                            {categories.map((category) => (
                                <option key={category.slug} value={category.slug}>{category.name}</option>
                            ))}
                            <option value={PROPOSE_CATEGORY_VALUE}>{t('business.apply.category.propose')}</option>
                        </Select>
                    </div>
                    {categoryChoice === PROPOSE_CATEGORY_VALUE ? (
                        <Input
                            label={t('business.apply.proposedCategory.label')}
                            required
                            maxLength={120}
                            value={proposedCategory}
                            onChange={(event) => {
                                setProposedCategory(event.target.value);
                                setErrorKey(null);
                            }}
                            placeholder={t('business.apply.proposedCategory.placeholder')}
                            helperText={t('business.apply.proposedCategory.helper')}
                        />
                    ) : null}
                    <label className="block">
                        <span className="type-label text-[var(--text-primary)]">{t('business.apply.field.comment')}</span>
                        <textarea
                            className="mt-2 min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]"
                            maxLength={2000}
                            {...field('comment')}
                        />
                    </label>
                    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-4">
                        <div>
                            <p className="type-label text-[var(--text-primary)]">{t('business.apply.links.title')}</p>
                            <p className="type-caption mt-1 text-[var(--text-muted)]">
                                {t('business.apply.links.description')}
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input label="Instagram" type="url" placeholder="https://instagram.com/..." {...field('instagram')} />
                            <Input label="2ГИС" type="url" placeholder="https://2gis.ru/..." {...field('two_gis')} />
                            <Input label={t('business.apply.links.googleMaps')} type="url" placeholder="https://maps.google.com/..." {...field('google_maps')} />
                            <Input label={t('business.apply.links.yandexMaps')} type="url" placeholder="https://yandex.ru/maps/..." {...field('yandex_maps')} />
                        </div>
                    </div>
                    <div className="hidden" aria-hidden="true">
                        <Input label="Website" tabIndex={-1} autoComplete="off" {...field('website')} />
                    </div>
                    <p className="type-caption text-[var(--text-muted)]">
                        {t('business.apply.consent')}
                    </p>
                    <Button type="submit" fullWidth isLoading={sending} disabled={sending}>
                        {t('business.apply.submit')}
                    </Button>
                </form>
            )}
        </Card>
    );
}
