'use client';

import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { type PublicContactFields } from '@/lib/businessContacts';

type Props = {
    initial: Required<PublicContactFields>;
};

export function BusinessContactSettingsForm({ initial }: Props) {
    const { t } = useLanguage();
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
                    text: typeof payload.message === 'string' ? payload.message
                        : typeof payload.error?.message === 'string' ? payload.error.message
                        : t('business.contactSettings.saveError'),
                });
                return;
            }
            setForm({
                contact_phone: payload.data?.contact_phone ?? '',
                contact_whatsapp: payload.data?.contact_whatsapp ?? '',
                contact_email: payload.data?.contact_email ?? '',
                website_url: payload.data?.website_url ?? '',
            });
            setMessage({ variant: 'success', text: t('business.contactSettings.saved') });
        } catch {
            setMessage({ variant: 'danger', text: t('business.contactSettings.networkError') });
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-5">
            {message ? <AlertBanner variant={message.variant} message={message.text} /> : null}

            <Card variant="elevated" padding="lg">
                <div className="mb-5">
                    <h2 className="type-section-title text-[var(--text-primary)]">{t('business.contactSettings.heading')}</h2>
                    <p className="type-body mt-1 text-[var(--text-secondary)]">
                        {t('business.contactSettings.description')}
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Input
                        label={t('business.contactSettings.phone')}
                        value={form.contact_phone ?? ''}
                        onChange={(event) => setForm((current) => ({ ...current, contact_phone: event.target.value }))}
                        placeholder="+996555123456"
                        inputMode="tel"
                        helperText={t('business.contactSettings.phoneHint')}
                    />
                    <Input
                        label={t('business.contactSettings.whatsapp')}
                        value={form.contact_whatsapp ?? ''}
                        onChange={(event) => setForm((current) => ({ ...current, contact_whatsapp: event.target.value }))}
                        placeholder="+996555123456"
                        inputMode="tel"
                        helperText={t('business.contactSettings.whatsappHint')}
                    />
                    <Input
                        label={t('business.contactSettings.email')}
                        value={form.contact_email ?? ''}
                        onChange={(event) => setForm((current) => ({ ...current, contact_email: event.target.value }))}
                        placeholder="hello@example.com"
                        type="email"
                    />
                    <Input
                        label={t('business.contactSettings.website')}
                        value={form.website_url ?? ''}
                        onChange={(event) => setForm((current) => ({ ...current, website_url: event.target.value }))}
                        placeholder="https://example.com"
                        type="url"
                        helperText={t('business.contactSettings.websiteHint')}
                    />
                </div>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" isLoading={saving} disabled={saving}>
                    {t('business.contactSettings.save')}
                </Button>
            </div>
        </form>
    );
}
