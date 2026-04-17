'use client';

import { useState } from 'react';

import { AdminFormSection } from '../../_components/AdminFormSection';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

type Role = {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    is_system?: boolean;
};

type MutRes = { ok: true } | { ok: false; error: string };

export default function EditRoleClient({ role }: { role: Role }) {
    const [name, setName] = useState(role.name);
    const [description, setDescription] = useState(role.description ?? '');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!name.trim()) {
            setError('Название роли обязательно.');
            return;
        }

        try {
            setSaving(true);
            setError(null);
            const response = await fetch(`/admin/api/roles/${encodeURIComponent(role.id)}/update`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                }),
            });
            const json = (await response.json()) as MutRes;
            if (!response.ok || !json.ok) {
                throw new Error(('error' in json && json.error) || `HTTP ${response.status}`);
            }
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2500);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : String(submitError));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card className="p-6">
            <form onSubmit={onSubmit} className="space-y-6">
                <AdminFormSection title="Параметры роли" description="Секция соответствует общему CRUD-паттерну форм.">
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-3">
                        <p className="type-caption text-[var(--text-secondary)]">Системный ключ</p>
                        <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">{role.key}</p>
                    </div>
                    <Input
                        label="Название *"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                    />
                    <div>
                        <label className="type-caption mb-1.5 block font-medium text-[var(--text-secondary)]">
                            Описание
                        </label>
                        <textarea
                            className="min-h-[96px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--focus-ring)] focus:outline-none"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="Кратко опишите назначение роли"
                        />
                    </div>
                </AdminFormSection>

                {success ? <AlertBanner variant="success" message="Изменения сохранены." compact /> : null}
                {error && !success ? <AlertBanner variant="danger" message={error} compact /> : null}

                <div className="flex items-center gap-3">
                    <Button type="submit" disabled={saving} isLoading={saving}>
                        {saving ? 'Сохраняем…' : 'Сохранить изменения'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}

