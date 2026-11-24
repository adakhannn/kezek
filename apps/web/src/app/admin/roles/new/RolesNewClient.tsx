'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AdminFormSection } from '../../_components/AdminFormSection';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

type Props = { baseURL: string };

export default function RolesNewClient({ baseURL }: Props) {
    const { t } = useLanguage();
    const router = useRouter();
    const [name, setName] = useState('');
    const [key, setKey] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);

        const trimmedName = name.trim();
        const trimmedKey = key.trim().toLowerCase();

        if (!trimmedName) {
            setError(t('admin.roles.form.nameRequired', 'Название роли обязательно.'));
            return;
        }
        if (!/^[a-z0-9_-]{2,32}$/.test(trimmedKey)) {
            setError(t('admin.roles.form.keyInvalid', 'Ключ роли: только [a-z0-9_-], длина 2-32 символа.'));
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`${baseURL}/admin/api/roles/create`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    key: trimmedKey,
                    name: trimmedName,
                    description: description.trim() || null,
                }),
            });
            const json = (await response.json()) as { ok: boolean; error?: string };
            if (!response.ok || !json.ok) {
                throw new Error(json.error || `HTTP ${response.status}`);
            }
            router.push('/admin/roles');
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : String(submitError));
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card className="p-6">
            <form onSubmit={submit} className="space-y-6">
                {error ? <AlertBanner variant="danger" message={error} compact /> : null}

                <AdminFormSection
                    title={t('admin.roles.form.dataTitle', 'Данные роли')}
                    description={t('admin.roles.form.dataDescription', 'Секция формы стандартизирована для admin CRUD.')}
                >
                    <Input
                        label={t('admin.roles.form.name', 'Название *')}
                        placeholder={t('admin.roles.form.namePlaceholder', 'Например: Оператор филиала')}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                    />
                    <Input
                        label={t('admin.roles.form.key', 'Системный ключ (slug) *')}
                        placeholder={t('admin.roles.form.keyPlaceholder', 'Например: branch_operator')}
                        value={key}
                        onChange={(event) => setKey(event.target.value)}
                        helperText={t('admin.roles.form.keyHelper', 'Только латиница/цифры/нижнее подчеркивание/дефис: a-z 0-9 _ -')}
                        required
                    />
                    <div>
                        <label className="type-caption mb-1.5 block font-medium text-[var(--text-secondary)]">
                            {t('admin.roles.form.description', 'Описание')}
                        </label>
                        <textarea
                            className="min-h-[96px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--focus-ring)] focus:outline-none"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder={t('admin.roles.form.descriptionPlaceholder', 'Кратко опишите назначение роли')}
                        />
                    </div>
                </AdminFormSection>

                <div className="flex items-center gap-3">
                    <Button type="submit" disabled={loading} isLoading={loading}>
                        {loading ? t('admin.roles.form.creating', 'Создаем…') : t('admin.roles.form.create', 'Создать роль')}
                    </Button>
                </div>
            </form>
        </Card>
    );
}

