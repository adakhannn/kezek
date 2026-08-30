'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import BranchMapPickerYandex from '@/components/admin/branches/BranchMapPickerYandex';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { PublicContactFields } from '@/lib/businessContacts';

type Initial = {
    id?: string;
    name: string;
    address: string | null;
    is_active: boolean;
    lat?: number | null;
    lon?: number | null;
    contact_phone?: string | null;
    contact_whatsapp?: string | null;
    contact_email?: string | null;
    website_url?: string | null;
    inherit_business_contacts?: boolean;
};

export default function BranchForm({
                                       initial,
                                       businessContacts = {},
                                       apiBase,
                                       yandexMapsApiKey,
                                   }: {
    initial: Initial;
    businessContacts?: PublicContactFields;
    apiBase: string; // '/api/branches'
    yandexMapsApiKey?: string;
}) {
    const r = useRouter();
    const { t } = useLanguage();
    const [form, setForm] = useState<Initial>(initial);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [lat, setLat] = useState<number | null>(initial.lat ?? null);
    const [lon, setLon] = useState<number | null>(initial.lon ?? null);
    const inheritsBusinessContacts = form.inherit_business_contacts !== false;

    function contactValue(field: keyof PublicContactFields): string {
        const branchValue = form[field];
        if (typeof branchValue === 'string' && branchValue) return branchValue;
        if (!inheritsBusinessContacts) return '';
        return businessContacts[field] ?? '';
    }

    function contactHelper(field: keyof PublicContactFields): string | undefined {
        if (!inheritsBusinessContacts || form[field]) return undefined;
        return businessContacts[field]
            ? t('branches.form.contacts.inheritedValue', 'Наследуется от бизнеса. Введите другое значение, чтобы переопределить.')
            : t('branches.form.contacts.missingBusinessValue', 'В контактах бизнеса это поле пока не заполнено.')
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true); setErr(null);
        try {
            const url = form.id
                ? `${apiBase}/${encodeURIComponent(form.id)}/update`
                : `${apiBase}/create`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({
                    ...form,
                    lat,
                    lon,
                }),
            });
            const text = await res.text();
            let payload;
            try { payload = JSON.parse(text); } catch { payload = { ok: false, error: text || 'NON_JSON_RESPONSE' }; }

            if (!res.ok || !payload.ok) {
                setErr(payload.error ?? `HTTP_${res.status}`);
                return;
            }
            r.push('/dashboard/branches');
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            {err && (
                <AlertBanner variant="danger" message={err} compact />
            )}

            <Input
                label={t('branches.form.name', 'Название')}
                value={form.name}
                onChange={(e)=>setForm(f=>({...f, name: e.target.value }))}
                required
            />

            {/* Карта Яндекса для выбора адреса */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('branches.form.addressLabel', 'Адрес и местоположение')}
                </label>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-2">
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">
                        {t('branches.form.addressHint', 'Как выбрать адрес:')}
                    </p>
                    <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
                        <li>{t('branches.form.addressHint1', 'Используйте поиск в верхнем левом углу карты для поиска адреса')}</li>
                        <li>{t('branches.form.addressHint2', 'Или кликните по карте в нужном месте — адрес определится автоматически')}</li>
                        <li>{t('branches.form.addressHint3', 'Метку можно перетаскивать для уточнения местоположения')}</li>
                    </ul>
                </div>
                <BranchMapPickerYandex
                    yandexMapsApiKey={yandexMapsApiKey}
                    lat={lat ?? undefined}
                    lon={lon ?? undefined}
                    onPick={(la, lo, addr) => {
                        setLat(la);
                        setLon(lo);
                        if (addr) {
                            setForm(f => ({ ...f, address: addr }));
                        }
                    }}
                />
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('branches.form.coordinates', 'Координаты:')} {lat ? lat.toFixed(6) : '—'}, {lon ? lon.toFixed(6) : '—'}
                </div>
            </div>

            <Input
                label={t('branches.form.address', 'Адрес')}
                value={form.address ?? ''}
                onChange={(e)=>setForm(f=>({...f, address: e.target.value || null }))}
                placeholder={t('branches.form.addressPlaceholder', 'Адрес будет определен автоматически при выборе на карте')}
                helperText={t('branches.form.addressManualHint', 'Адрес можно выбрать на карте или ввести вручную')}
            />

            <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                <div>
                    <h2 className="type-section-title text-[var(--text-primary)]">
                        {t('branches.form.contacts.title', 'Контакты филиала')}
                    </h2>
                    <p className="type-caption mt-1 text-[var(--text-secondary)]">
                        {t('branches.form.contacts.description', 'Укажите публичные контакты этой локации. Пустые поля могут наследоваться от бизнеса.')}
                    </p>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--surface-emphasis)] p-3">
                    <input
                        type="checkbox"
                        checked={inheritsBusinessContacts}
                        onChange={(event) => setForm((current) => ({
                            ...current,
                            inherit_business_contacts: event.target.checked,
                        }))}
                        className="mt-0.5 h-5 w-5 rounded border-[var(--border-default)]"
                    />
                    <span>
                        <span className="block text-sm font-medium text-[var(--text-primary)]">
                            {t('branches.form.contacts.inherit', 'Использовать контакты бизнеса')}
                        </span>
                        <span className="block text-xs text-[var(--text-secondary)]">
                            {t('branches.form.contacts.inheritHint', 'Только для полей, которые не заполнены у филиала.')}
                        </span>
                    </span>
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                    <Input
                        label={t('branches.form.contacts.phone', 'Телефон филиала')}
                        value={contactValue('contact_phone')}
                        onChange={(event) => setForm((current) => ({ ...current, contact_phone: event.target.value }))}
                        helperText={contactHelper('contact_phone')}
                        placeholder="+996555123456"
                        inputMode="tel"
                    />
                    <Input
                        label={t('branches.form.contacts.whatsapp', 'WhatsApp филиала')}
                        value={contactValue('contact_whatsapp')}
                        onChange={(event) => setForm((current) => ({ ...current, contact_whatsapp: event.target.value }))}
                        helperText={contactHelper('contact_whatsapp')}
                        placeholder="+996555123456"
                        inputMode="tel"
                    />
                    <Input
                        label={t('branches.form.contacts.email', 'Email филиала')}
                        value={contactValue('contact_email')}
                        onChange={(event) => setForm((current) => ({ ...current, contact_email: event.target.value }))}
                        helperText={contactHelper('contact_email')}
                        type="email"
                    />
                    <Input
                        label={t('branches.form.contacts.website', 'Сайт филиала')}
                        value={contactValue('website_url')}
                        onChange={(event) => setForm((current) => ({ ...current, website_url: event.target.value }))}
                        helperText={contactHelper('website_url')}
                        placeholder="https://example.com"
                        type="url"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <input
                    id="is_active"
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={(e)=>setForm(f=>({...f, is_active: e.target.checked }))}
                    className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    {t('branches.form.active', 'Активен (отображается клиентам)')}
                </label>
            </div>

            <div className="pt-2">
                <Button type="submit" disabled={saving} isLoading={saving}>
                    {saving ? t('branches.form.saving', 'Сохраняем…') : t('branches.form.save', 'Сохранить')}
                </Button>
            </div>
        </form>
    );
}
