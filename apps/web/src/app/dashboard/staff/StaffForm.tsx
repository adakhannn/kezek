'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import {logDebug} from '@/lib/log';
import { validateEmail, validateName, validatePercent, validatePercentSum, validatePhone, validatePositiveNumber } from '@/lib/validation';

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
    const { t } = useLanguage();
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
            
            // Валидация обязательных полей
            const nameValidation = validateName(form.full_name);
            if (!nameValidation.valid) {
                setErr(nameValidation.error || t('staff.form.errors.nameRequired', 'ФИО обязательно'));
                setSaving(false);
                return;
            }

            if (!form.branch_id) {
                setErr(t('staff.form.errors.branchRequired', 'Выберите филиал'));
                setSaving(false);
                return;
            }

            // Валидация email (если заполнен)
            if (form.email && form.email.trim()) {
                const emailValidation = validateEmail(form.email);
                if (!emailValidation.valid) {
                    setErr(emailValidation.error || t('staff.form.errors.emailInvalid', 'Неверный формат email'));
                    setSaving(false);
                    return;
                }
            }

            // Валидация телефона (если заполнен)
            if (form.phone && form.phone.trim()) {
                const phoneValidation = validatePhone(form.phone, false);
                if (!phoneValidation.valid) {
                    setErr(phoneValidation.error || t('staff.form.errors.phoneInvalid', 'Неверный формат телефона'));
                    setSaving(false);
                    return;
                }
            }

            // Валидация процентов
            const masterPercent = form.percent_master ?? 60;
            const salonPercent = form.percent_salon ?? 40;

            const masterPercentValidation = validatePercent(masterPercent);
            if (!masterPercentValidation.valid) {
                setErr(masterPercentValidation.error || t('staff.form.errors.percentMasterInvalid', 'Доля мастера должна быть от 0 до 100%'));
                setSaving(false);
                return;
            }

            const salonPercentValidation = validatePercent(salonPercent);
            if (!salonPercentValidation.valid) {
                setErr(salonPercentValidation.error || t('staff.form.errors.percentSalonInvalid', 'Доля салона должна быть от 0 до 100%'));
                setSaving(false);
                return;
            }

            const percentSumValidation = validatePercentSum(masterPercent, salonPercent);
            if (!percentSumValidation.valid) {
                setErr(percentSumValidation.error || t('staff.form.errors.percentSumInvalid', 'Сумма процентов должна быть равна 100%'));
                setSaving(false);
                return;
            }

            // Валидация hourly_rate (если заполнен)
            if (form.hourly_rate !== null && form.hourly_rate !== undefined) {
                const hourlyRateValidation = validatePositiveNumber(form.hourly_rate, { min: 0, allowZero: false });
                if (!hourlyRateValidation.valid) {
                    setErr(hourlyRateValidation.error || t('staff.form.errors.hourlyRateInvalid', 'Ставка за час должна быть больше 0'));
                    setSaving(false);
                    return;
                }
            }
            
            const requestBody = JSON.stringify(form);
            logDebug('StaffForm', 'Sending form data', { form });
            
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: requestBody,
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
        <form onSubmit={onSubmit} className="space-y-6">
            {err && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3">
                    <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
                </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('staff.form.fullName.label', 'ФИО')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-400"
                        value={form.full_name}
                        onChange={e => set('full_name', e.target.value)}
                        placeholder={t('staff.form.fullName.placeholder', 'Иванов Иван Иванович')}
                        required
                    />
                </div>
                <div className="flex items-center gap-3 pt-8">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            id="is_active"
                            type="checkbox"
                            checked={form.is_active}
                            onChange={e => set('is_active', e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('staff.form.active.label', 'Активен')}</span>
                    </label>
                    {form.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {t('staff.form.active.working', 'Работает')}
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-gray-400" />
                            {t('staff.form.active.inactive', 'Неактивен')}
                        </span>
                    )}
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('staff.form.email.label', 'E-mail')}
                    </label>
                    <input
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-400"
                        value={form.email ?? ''}
                        onChange={e => set('email', e.target.value || null)}
                        type="email"
                        placeholder={t('staff.form.email.placeholder', 'ivan@example.com')}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('staff.form.phone.label', 'Телефон')}
                    </label>
                    <input
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-400"
                        value={form.phone ?? ''}
                        onChange={e => set('phone', e.target.value || null)}
                        placeholder={t('staff.form.phone.placeholder', '+996555123456')}
                    />
                </div>
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('staff.form.income.title', 'Распределение доходов')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('staff.form.income.desc', 'Проценты распределяются от чистой суммы (после вычета расходников). Расходники 100% идут салону.')}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.form.income.master.label', 'Доля мастера (%)')}
                        </label>
                        <div className="relative">
                            <input
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400"
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
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                                {form.percent_master ?? 60}%
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.form.income.salon.label', 'Доля салона (%)')}
                        </label>
                        <div className="relative">
                            <input
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400"
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
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                                {form.percent_salon ?? 40}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('staff.form.hourly.title', 'Оплата за выход')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('staff.form.hourly.desc', 'Если указана ставка, сотрудник получает оплату за выход. Если сумма за выход больше доли от выручки, владелец доплачивает разницу.')}</p>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('staff.form.hourly.rate.label', 'Ставка за час (сом/час)')}
                    </label>
                    <input
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-400"
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.hourly_rate ?? ''}
                        onChange={e => {
                            const val = e.target.value.trim();
                            set('hourly_rate', val === '' ? null : Number(val) || null);
                        }}
                        placeholder={t('staff.form.hourly.rate.placeholder', 'Не указано (сотрудник получает только процент от выручки)')}
                    />
                </div>
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? (
                        <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {t('staff.form.save.saving', 'Сохранение...')}
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {t('staff.form.save.button', 'Сохранить изменения')}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
