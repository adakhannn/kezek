'use client';

import { useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export type BusinessCategoryOption = {
    slug: string;
    name: string;
};

const PROPOSE_CATEGORY_VALUE = '__propose_category__';

const emptyForm = {
    contact_name: '',
    phone: '',
    email: '',
    business_name: '',
    city: '',
    comment: '',
    website: '',
    instagram: '',
    two_gis: '',
    google_maps: '',
    yandex_maps: '',
};

export type BusinessApplicationInitialValues = Partial<Pick<
    typeof emptyForm,
    'contact_name' | 'phone' | 'email' | 'city'
>>;

function createInitialForm(initialValues?: BusinessApplicationInitialValues) {
    return {
        ...emptyForm,
        ...initialValues,
        city: initialValues?.city?.trim() || 'Ош',
    };
}

export function BusinessApplicationForm({
    categories,
    initialValues,
}: {
    categories: BusinessCategoryOption[];
    initialValues?: BusinessApplicationInitialValues;
}) {
    const [form, setForm] = useState(() => createInitialForm(initialValues));
    const [categoryChoice, setCategoryChoice] = useState(categories.length ? '' : PROPOSE_CATEGORY_VALUE);
    const [proposedCategory, setProposedCategory] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
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
        setError(null);

        const category = categoryChoice === PROPOSE_CATEGORY_VALUE
            ? proposedCategory.trim()
            : categoryChoice;
        if (!category) {
            setError(categoryChoice === PROPOSE_CATEGORY_VALUE
                ? 'Укажите название новой категории.'
                : 'Выберите категорию бизнеса или предложите новую.');
            return;
        }

        setSending(true);
        try {
            const response = await fetch('/api/business-applications', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ ...form, category }),
            });
            const payload = (await response.json()) as { ok?: boolean; message?: string };
            if (!response.ok || !payload.ok) {
                throw new Error(payload.message || 'Не удалось отправить заявку');
            }
            setSent(true);
            setForm(createInitialForm(initialValues));
            setCategoryChoice(categories.length ? '' : PROPOSE_CATEGORY_VALUE);
            setProposedCategory('');
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Не удалось отправить заявку');
        } finally {
            setSending(false);
        }
    }

    return (
        <Card variant="elevated" padding="lg">
            {sent ? (
                <AlertBanner
                    variant="success"
                    title="Заявка отправлена"
                    message="Мы получили ваши данные. После проверки бизнес появится в вашем аккаунте, и мы свяжемся с вами для уточнения деталей."
                />
            ) : (
                <form onSubmit={submit} className="space-y-5">
                    {error ? <AlertBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Ваше имя" required {...field('contact_name')} />
                        <Input label="Телефон" type="tel" required placeholder="+996555123456" {...field('phone')} />
                        <Input label="Email" type="email" required {...field('email')} />
                        <Input label="Название бизнеса" required {...field('business_name')} />
                        <Input label="Город" required {...field('city')} />
                        <div className="w-full">
                            <label htmlFor="business-category" className="type-caption mb-1.5 block font-medium text-[var(--text-secondary)]">
                                Категория бизнеса
                            </label>
                            <select
                                id="business-category"
                                required
                                value={categoryChoice}
                                onChange={(event) => {
                                    setCategoryChoice(event.target.value);
                                    setError(null);
                                }}
                                className="motion-interactive min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-[16px] text-[var(--text-primary)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:outline-none focus:ring-0 sm:min-h-[40px] sm:text-sm"
                            >
                                <option value="" disabled>Выберите категорию</option>
                                {categories.map((category) => (
                                    <option key={category.slug} value={category.slug}>{category.name}</option>
                                ))}
                                <option value={PROPOSE_CATEGORY_VALUE}>Моей категории нет — предложить новую</option>
                            </select>
                            <p className="type-caption mt-1.5 text-[var(--text-muted)]">
                                Выберите готовую категорию — так заявка пройдёт проверку быстрее.
                            </p>
                        </div>
                    </div>
                    {categoryChoice === PROPOSE_CATEGORY_VALUE ? (
                        <Input
                            label="Предложите новую категорию"
                            required
                            maxLength={120}
                            value={proposedCategory}
                            onChange={(event) => {
                                setProposedCategory(event.target.value);
                                setError(null);
                            }}
                            placeholder="Например, груминг-салон"
                            helperText="Новая категория появится в системе только после проверки администратором."
                        />
                    ) : null}
                    <label className="block">
                        <span className="type-label text-[var(--text-primary)]">Комментарий</span>
                        <textarea
                            className="mt-2 min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]"
                            maxLength={2000}
                            {...field('comment')}
                        />
                    </label>
                    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-4">
                        <div>
                            <p className="type-label text-[var(--text-primary)]">Ссылки филиала</p>
                            <p className="type-caption mt-1 text-[var(--text-muted)]">
                                Укажите страницы именно этой локации. После одобрения они будут привязаны к первому созданному филиалу и показаны клиентам.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input label="Instagram" type="url" placeholder="https://instagram.com/..." {...field('instagram')} />
                            <Input label="2ГИС" type="url" placeholder="https://2gis.ru/..." {...field('two_gis')} />
                            <Input label="Google Карты" type="url" placeholder="https://maps.google.com/..." {...field('google_maps')} />
                            <Input label="Яндекс Карты" type="url" placeholder="https://yandex.ru/maps/..." {...field('yandex_maps')} />
                        </div>
                    </div>
                    <div className="hidden" aria-hidden="true">
                        <Input label="Website" tabIndex={-1} autoComplete="off" {...field('website')} />
                    </div>
                    <p className="type-caption text-[var(--text-muted)]">
                        Отправляя заявку, вы соглашаетесь на обработку контактных данных для связи по вопросу подключения бизнеса.
                    </p>
                    <Button type="submit" fullWidth isLoading={sending} disabled={sending}>
                        Отправить заявку
                    </Button>
                </form>
            )}
        </Card>
    );
}
