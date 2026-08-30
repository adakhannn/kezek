'use client';

import { useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { type PublicContactFields } from '@/lib/businessContacts';

type Props = {
    initial: Required<PublicContactFields>;
};

export function BusinessContactSettingsForm({ initial }: Props) {
    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ variant: 'success' | 'danger'; text: string } | null>(null);

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const response = await fetch('/api/dashboard/contact-settings', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(form),
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                setMessage({
                    variant: 'danger',
                    text: payload.error?.message || payload.error || 'Не удалось сохранить контакты',
                });
                return;
            }
            setForm({
                contact_phone: payload.data?.contact_phone ?? '',
                contact_whatsapp: payload.data?.contact_whatsapp ?? '',
                contact_email: payload.data?.contact_email ?? '',
                website_url: payload.data?.website_url ?? '',
            });
            setMessage({ variant: 'success', text: 'Публичные контакты сохранены' });
        } catch {
            setMessage({ variant: 'danger', text: 'Не удалось связаться с сервером' });
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-5">
            {message ? <AlertBanner variant={message.variant} message={message.text} /> : null}

            <Card variant="elevated" padding="lg">
                <div className="mb-5">
                    <h2 className="type-section-title text-[var(--text-primary)]">Контакты бизнеса</h2>
                    <p className="type-body mt-1 text-[var(--text-secondary)]">
                        Эти данные видят клиенты. Они не связаны с телефонами входа, владельцев или сотрудников.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Input
                        label="Публичный телефон"
                        value={form.contact_phone ?? ''}
                        onChange={(event) => setForm((current) => ({ ...current, contact_phone: event.target.value }))}
                        placeholder="+996555123456"
                        inputMode="tel"
                        helperText="Основной номер для звонков клиентов"
                    />
                    <Input
                        label="Рабочий WhatsApp"
                        value={form.contact_whatsapp ?? ''}
                        onChange={(event) => setForm((current) => ({ ...current, contact_whatsapp: event.target.value }))}
                        placeholder="+996555123456"
                        inputMode="tel"
                        helperText="Только бизнес-номер, не номер авторизации"
                    />
                    <Input
                        label="Публичный email"
                        value={form.contact_email ?? ''}
                        onChange={(event) => setForm((current) => ({ ...current, contact_email: event.target.value }))}
                        placeholder="hello@example.com"
                        type="email"
                    />
                    <Input
                        label="Сайт"
                        value={form.website_url ?? ''}
                        onChange={(event) => setForm((current) => ({ ...current, website_url: event.target.value }))}
                        placeholder="https://example.com"
                        type="url"
                        helperText="Только HTTPS-ссылка"
                    />
                </div>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" isLoading={saving} disabled={saving}>
                    Сохранить контакты
                </Button>
            </div>
        </form>
    );
}
