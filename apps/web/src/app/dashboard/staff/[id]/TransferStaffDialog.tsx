'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

type Branch = { id: string; name: string };

export default function TransferStaffDialog({
    staffId,
    currentBranchId,
    branches,
    explicitScheduling = false,
}: {
    staffId: string;
    currentBranchId: string;
    branches: Branch[];
    explicitScheduling?: boolean;
}) {
    const { t } = useLanguage();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState<string>('');
    const [copySchedule, setCopySchedule] = useState<boolean>(true);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const otherBranches = branches.filter((branch) => branch.id !== currentBranchId);
    const currentBranch = branches.find((branch) => branch.id === currentBranchId);

    async function submit() {
        setLoading(true);
        setErr(null);

        try {
            if (!target) {
                setErr(t('staff.transfer.errors.selectBranch', 'Р’С‹Р±РµСЂРёС‚Рµ С„РёР»РёР°Р»'));
                setLoading(false);
                return;
            }

            const res = await fetch(`/api/staff/${encodeURIComponent(staffId)}/transfer`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ target_branch_id: target, expected_branch_id: currentBranchId, copy_schedule: explicitScheduling ? false : copySchedule }),
            });
            const json = await res.json().catch(() => ({ ok: false, error: 'NON_JSON_RESPONSE' }));
            if (!res.ok || !json.ok) {
                setErr(json.message ?? json.error ?? `HTTP_${res.status}`);
                setLoading(false);
                return;
            }

            setOpen(false);
            router.refresh();
        } catch (error: unknown) {
            setErr(error instanceof Error ? error.message : String(error));
            setLoading(false);
        }
    }

    return (
        <div>
            <Button
                type="button"
                variant="ghost"
                className="rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white"
                leadingIcon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                }
                onClick={() => {
                    setOpen(true);
                    setTarget('');
                    setErr(null);
                }}
            >
                {t('staff.transfer.button', 'РџРµСЂРµРІРµСЃС‚Рё СЃРѕС‚СЂСѓРґРЅРёРєР°')}
            </Button>

            <Dialog
                open={open}
                onClose={() => {
                    if (!loading) setOpen(false);
                }}
                title={t('staff.transfer.title', 'РџРѕСЃС‚РѕСЏРЅРЅС‹Р№ РїРµСЂРµРІРѕРґ СЃРѕС‚СЂСѓРґРЅРёРєР°')}
                description={t('staff.transfer.subtitle', 'РџРµСЂРµРІРµСЃС‚Рё СЃРѕС‚СЂСѓРґРЅРёРєР° РІ РґСЂСѓРіРѕР№ С„РёР»РёР°Р» РЅР° РїРѕСЃС‚РѕСЏРЅРЅРѕР№ РѕСЃРЅРѕРІРµ')}
                size="md"
                dismissible={!loading}
                className="max-h-[90vh] overflow-y-auto"
                footer={
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
                            {t('staff.transfer.cancel', 'РћС‚РјРµРЅРёС‚СЊ')}
                        </Button>
                        <Button
                            type="button"
                            onClick={submit}
                            disabled={loading || !target}
                            isLoading={loading}
                            leadingIcon={
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            }
                        >
                            {t('staff.transfer.submit', 'РџРѕРґС‚РІРµСЂРґРёС‚СЊ РїРµСЂРµРІРѕРґ')}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4 sm:space-y-5">
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 sm:p-4">
                        <div className="mb-1 flex items-center gap-2">
                            <svg className="h-4 w-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="type-label text-[var(--text-secondary)]">
                                {t('staff.transfer.current', 'РўРµРєСѓС‰РёР№ С„РёР»РёР°Р»:')}
                            </span>
                        </div>
                        <p className="type-section-title text-[var(--text-primary)]">{currentBranch?.name ?? 'вЂ”'}</p>
                    </div>

                    <div className="space-y-2">
                        <label className="type-label block text-[var(--text-primary)]">
                            {t('staff.transfer.target.label', 'РќРѕРІС‹Р№ С„РёР»РёР°Р» *')}
                        </label>
                        <select
                            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--focus-ring)] focus:outline-none focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--focus-ring)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                            value={target}
                            onChange={(event) => setTarget(event.target.value)}
                            disabled={loading}
                        >
                            <option value="">{t('staff.transfer.target.select', 'вЂ” РІС‹Р±РµСЂРёС‚Рµ С„РёР»РёР°Р» вЂ”')}</option>
                            {otherBranches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {explicitScheduling ? <AlertBanner variant="info" message={t('scheduling.transferHint')} /> : <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 sm:p-4">
                        <label className="inline-flex cursor-pointer items-start gap-3">
                            <input
                                type="checkbox"
                                checked={copySchedule}
                                onChange={(event) => setCopySchedule(event.target.checked)}
                                disabled={loading}
                                className="mt-0.5 h-4 w-4 rounded border-[var(--border-default)] text-[var(--accent-primary)] focus:ring-[var(--focus-ring)]"
                            />
                            <div className="min-w-0 flex-1">
                                <span className="type-body block text-[var(--text-primary)]">
                                    {t('staff.transfer.copySchedule', 'РЎРєРѕРїРёСЂРѕРІР°С‚СЊ С€Р°Р±Р»РѕРЅ СЂР°СЃРїРёСЃР°РЅРёСЏ')}
                                </span>
                                <span className="type-caption mt-1 block text-[var(--text-muted)]">
                                    {t('staff.transfer.copyScheduleDesc', 'РЎРєРѕРїРёСЂРѕРІР°С‚СЊ РµР¶РµРЅРµРґРµР»СЊРЅРѕРµ СЂР°СЃРїРёСЃР°РЅРёРµ РёР· С‚РµРєСѓС‰РµРіРѕ С„РёР»РёР°Р»Р° РІ РЅРѕРІС‹Р№')}
                                </span>
                            </div>
                        </label>
                    </div>}

                    <AlertBanner
                        variant="warning"
                        title={t('staff.transfer.warning.title', 'Р’Р°Р¶РЅРѕ:')}
                        message={[
                            t('staff.transfer.warning.permanent', 'Р­С‚Рѕ РїРѕСЃС‚РѕСЏРЅРЅС‹Р№ РїРµСЂРµРІРѕРґ вЂ” СЃРѕС‚СЂСѓРґРЅРёРє Р±СѓРґРµС‚ РїСЂРёРєСЂРµРїР»РµРЅ Рє РЅРѕРІРѕРјСѓ С„РёР»РёР°Р»Сѓ РЅР° РїРѕСЃС‚РѕСЏРЅРЅРѕР№ РѕСЃРЅРѕРІРµ'),
                            t('staff.transfer.warning.bookings', 'Р‘СѓРґСѓС‰РёРµ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ РѕСЃС‚Р°РЅСѓС‚СЃСЏ Р±РµР· РёР·РјРµРЅРµРЅРёР№ (РїСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё РёС… РЅСѓР¶РЅРѕ Р±СѓРґРµС‚ РїРµСЂРµРЅРµСЃС‚Рё РѕС‚РґРµР»СЊРЅРѕ)'),
                            t('staff.transfer.warning.history', 'РСЃС‚РѕСЂРёСЏ РїРµСЂРµРІРѕРґРѕРІ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ СЃРёСЃС‚РµРјРµ'),
                        ].join(' ')}
                    />

                    {err ? <AlertBanner variant="danger" message={err} /> : null}
                </div>
            </Dialog>
        </div>
    );
}
