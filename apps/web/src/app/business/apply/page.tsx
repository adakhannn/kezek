'use client';

import { useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const initial = {
    contact_name: '', phone: '', email: '', business_name: '', city: '', category: '', comment: '', website: '',
    instagram: '', two_gis: '', google_maps: '', yandex_maps: '',
};

export default function BusinessApplicationPage() {
    const [form, setForm] = useState(initial);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    function field(name: keyof typeof initial) {
        return { value: form[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [name]: event.target.value })) };
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setSending(true);
        setError(null);
        try {
            const response = await fetch('/api/business-applications', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(form),
            });
            const payload = (await response.json()) as { ok?: boolean; message?: string };
            if (!response.ok || !payload.ok) throw new Error(payload.message || 'Не удалось отправить заявку');
            setSent(true);
            setForm(initial);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Не удалось отправить заявку');
        } finally {
            setSending(false);
        }
    }

    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
            <div className="mb-6 text-center">
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">Подключить бизнес к Kezek</h1>
                <p className="mt-2 text-[var(--text-secondary)]">Оставить заявку может любой человек — регистрация и вход не требуются.</p>
            </div>
            <Card variant="elevated" padding="lg">
                {sent ? (
                    <AlertBanner variant="success" title="Заявка отправлена" message="Мы получили ваши данные и свяжемся с вами для уточнения деталей регистрации бизнеса." />
                ) : (
                    <form onSubmit={submit} className="space-y-5">
                        {error ? <AlertBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input label="Ваше имя" required {...field('contact_name')} />
                            <Input label="Телефон" type="tel" required placeholder="+996555123456" {...field('phone')} />
                            <Input label="Email" type="email" {...field('email')} />
                            <Input label="Название бизнеса" required {...field('business_name')} />
                            <Input label="Город" {...field('city')} />
                            <Input label="Категория бизнеса" placeholder="Салон, клиника, автосервис…" {...field('category')} />
                        </div>
                        <label className="block">
                            <span className="type-label text-[var(--text-primary)]">Комментарий</span>
                            <textarea className="mt-2 min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]" maxLength={2000} {...field('comment')} />
                        </label>
                        <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-4">
                            <div>
                                <p className="type-label text-[var(--text-primary)]">Ссылки филиала</p>
                                <p className="type-caption mt-1 text-[var(--text-muted)]">Укажите страницы именно этой локации. После одобрения они будут привязаны к первому созданному филиалу и показаны клиентам.</p>
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
                        <p className="type-caption text-[var(--text-muted)]">Отправляя заявку, вы соглашаетесь на обработку контактных данных для связи по вопросу подключения бизнеса.</p>
                        <Button type="submit" fullWidth isLoading={sending} disabled={sending}>Отправить заявку</Button>
                    </form>
                )}
            </Card>
        </main>
    );
}
