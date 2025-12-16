'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Staff = {
    id?: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    branch_id: string;
    is_active: boolean;
    percent_master?: number;
    percent_salon?: number;
    hourly_rate?: number | null;
};

export default function StaffForm({
                                      initial,
                                      apiBase,
                                  }: {
    initial: Staff;
    apiBase: string; // '/api/staff'
}) {
    const r = useRouter();
    const [form, setForm] = useState<Staff>(initial);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    function set<K extends keyof Staff>(k: K, v: Staff[K]) {
        setForm((f) => ({ ...f, [k]: v }));
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
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(form),
            });

            const text = await res.text();
            let payload;
            try { payload = JSON.parse(text); } catch { payload = { ok: false, error: text || 'NON_JSON_RESPONSE' }; }

            if (!res.ok || !payload.ok) {
                setErr(payload.error ?? `HTTP_${res.status}`);
                return;
            }
            // успех
            r.push('/dashboard/staff');
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }


    return (
        <form onSubmit={onSubmit} className="space-y-3">
            {err && <div className="text-red-600 text-sm">{err}</div>}

            <div>
                <label className="block text-sm text-gray-600 mb-1">ФИО</label>
                <input
                    className="border rounded px-3 py-2 w-full"
                    value={form.full_name}
                    onChange={e => set('full_name', e.target.value)}
                    required
                />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm text-gray-600 mb-1">E-mail</label>
                    <input
                        className="border rounded px-3 py-2 w-full"
                        value={form.email ?? ''}
                        onChange={e => set('email', e.target.value || null)}
                        type="email"
                        placeholder="optional"
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Телефон</label>
                    <input
                        className="border rounded px-3 py-2 w-full"
                        value={form.phone ?? ''}
                        onChange={e => set('phone', e.target.value || null)}
                        placeholder="+996…"
                    />
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 mt-6 sm:mt-0">
                    <input
                        id="is_active"
                        type="checkbox"
                        checked={form.is_active}
                        onChange={e => set('is_active', e.target.checked)}
                    />
                    <label htmlFor="is_active">Активен</label>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Распределение доходов</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">
                            Доля мастера (%)
                        </label>
                        <input
                            className="border rounded px-3 py-2 w-full"
                            type="number"
                            min={0}
                            max={100}
                            value={form.percent_master ?? 60}
                            onChange={e => {
                                const master = Number(e.target.value) || 0;
                                set('percent_master', master);
                                set('percent_salon', 100 - master);
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">
                            Доля салона (%)
                        </label>
                        <input
                            className="border rounded px-3 py-2 w-full"
                            type="number"
                            min={0}
                            max={100}
                            value={form.percent_salon ?? 40}
                            onChange={e => {
                                const salon = Number(e.target.value) || 0;
                                set('percent_salon', salon);
                                set('percent_master', 100 - salon);
                            }}
                        />
                    </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Проценты распределяются от чистой суммы (после вычета расходников). Расходники 100% идут салону.
                </p>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Оплата за выход</h3>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">
                        Ставка за час (сом/час)
                    </label>
                    <input
                        className="border rounded px-3 py-2 w-full"
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.hourly_rate ?? ''}
                        onChange={e => {
                            const val = e.target.value.trim();
                            set('hourly_rate', val === '' ? null : Number(val) || null);
                        }}
                        placeholder="Не указано (сотрудник получает только процент от выручки)"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Если указана ставка, сотрудник получает оплату за выход. Если сумма за выход больше доли от выручки, владелец доплачивает разницу.
                    </p>
                </div>
            </div>

            <div className="pt-2">
                <button disabled={saving} className="border rounded px-4 py-2">
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                </button>
            </div>
        </form>
    );
}
