'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { logWarn } from '@/lib/log';

type Business = {
    id: string;
    name: string | null;
    city: string | null;
    slug: string | null;
};

type State =
    | { status: 'loading' }
    | { status: 'idle'; currentBizId: string | null; businesses: Business[] }
    | { status: 'error' };

function businessName(business: Business | null | undefined, fallback: string) {
    return business?.name || business?.slug || fallback;
}

export function BusinessSwitcher({ serverCurrentBizId }: { serverCurrentBizId?: string } = {}) {
    const { t } = useLanguage();
    const router = useRouter();
    const [state, setState] = useState<State>({ status: 'loading' });
    const [isOpen, setIsOpen] = useState(false);
    const [switchingBusiness, setSwitchingBusiness] = useState<Business | null>(null);
    const [switchError, setSwitchError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetch('/api/me/current-business', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    cache: 'no-store',
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const result = (await response.json()) as {
                    ok: boolean;
                    data?: { currentBizId: string | null; businesses: Business[] };
                };
                if (!result.ok || !result.data) throw new Error('Invalid current-business response');
                if (cancelled) return;

                setState({
                    status: 'idle',
                    currentBizId: result.data.currentBizId,
                    businesses: Array.isArray(result.data.businesses) ? result.data.businesses : [],
                });
            } catch (error) {
                logWarn('BusinessSwitcher', 'failed to load businesses', error);
                if (!cancelled) setState({ status: 'error' });
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!switchingBusiness) return;

        if (serverCurrentBizId === switchingBusiness.id) {
            setSwitchingBusiness(null);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setSwitchingBusiness(null);
            setSwitchError(t('dashboard.businessSwitcher.timeout'));
        }, 15_000);

        return () => window.clearTimeout(timeoutId);
    }, [serverCurrentBizId, switchingBusiness, t]);

    const handleSelect = async (business: Business) => {
        if (state.status !== 'idle' || switchingBusiness) return;

        const effectiveBizId = serverCurrentBizId ?? state.currentBizId;
        if (effectiveBizId === business.id) {
            setIsOpen(false);
            return;
        }

        setSwitchError(null);
        setSwitchingBusiness(business);

        try {
            const response = await fetch('/api/me/current-business', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bizId: business.id }),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = (await response.json()) as { ok?: boolean };
            if (!result.ok) throw new Error('Business switch failed');

            setIsOpen(false);
            router.refresh();
        } catch (error) {
            logWarn('BusinessSwitcher', 'failed to switch business', error);
            setSwitchingBusiness(null);
            setSwitchError(t('dashboard.businessSwitcher.changeError'));
        }
    };

    if (state.status === 'error') {
        return (
            <AlertBanner
                variant="danger"
                message={t('dashboard.businessSwitcher.errorShort')}
                compact
                className="mt-2"
            />
        );
    }

    if (state.status === 'loading') {
        return (
            <div
                className="mt-2 h-8 w-40 animate-pulse rounded-lg bg-[var(--surface-emphasis)]"
                aria-label={t('dashboard.businessSwitcher.loading')}
            />
        );
    }

    const { currentBizId, businesses } = state;
    if (businesses.length === 0) return null;

    const effectiveBizId = serverCurrentBizId ?? currentBizId;
    const current = businesses.find((business) => business.id === effectiveBizId) ?? businesses[0];
    const currentName = businessName(current, t('dashboard.businessSwitcher.unknown'));
    const currentLabel = current.city ? `${currentName} · ${current.city}` : currentName;

    if (businesses.length === 1) {
        return (
            <div className="mt-3">
                <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-[var(--shadow-xs)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="max-w-[140px] truncate">{currentLabel}</span>
                </div>
            </div>
        );
    }

    const switchingName = businessName(switchingBusiness, t('dashboard.businessSwitcher.unknown'));

    return (
        <>
            <div className="mt-3">
                <button
                    type="button"
                    disabled={Boolean(switchingBusiness)}
                    onClick={() => setIsOpen((previous) => !previous)}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-[var(--shadow-xs)] transition hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:cursor-wait disabled:opacity-70"
                >
                    {switchingBusiness ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
                    ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                    <span className="max-w-[140px] truncate">{currentLabel}</span>
                    <svg
                        aria-hidden="true"
                        className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                    >
                        <path d="M6 8l4 4 4-4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>

                {isOpen ? (
                    <div
                        role="listbox"
                        aria-label={t('dashboard.businessSwitcher.listLabel')}
                        className="mt-2 max-h-56 w-56 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] py-1 text-xs shadow-[var(--shadow-lg)]"
                    >
                        {businesses.map((business) => {
                            const active = business.id === current.id;
                            const title = businessName(business, t('dashboard.businessSwitcher.unknown'));
                            return (
                                <button
                                    key={business.id}
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    disabled={Boolean(switchingBusiness)}
                                    onClick={() => void handleSelect(business)}
                                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition disabled:cursor-wait disabled:opacity-70 ${
                                        active
                                            ? 'bg-[var(--surface-emphasis)] font-semibold text-[var(--text-primary)]'
                                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <span className="flex min-w-0 flex-col">
                                        <span className="truncate">{title}</span>
                                        {business.city ? (
                                            <span className="truncate text-[10px] font-normal text-[var(--text-muted)]">
                                                {business.city}
                                            </span>
                                        ) : null}
                                    </span>
                                    {switchingBusiness?.id === business.id ? (
                                        <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
                                    ) : active ? (
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                ) : null}

                {switchError ? (
                    <AlertBanner variant="danger" message={switchError} compact className="mt-2" />
                ) : null}
            </div>

            {switchingBusiness && typeof document !== 'undefined'
                ? createPortal(
                      <div
                          className="fixed inset-0 z-[250] flex items-center justify-center bg-[color:color-mix(in_srgb,var(--surface-page)_72%,transparent)] px-4 backdrop-blur-sm"
                          role="status"
                          aria-live="polite"
                          aria-busy="true"
                      >
                          <div className="w-full max-w-sm rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 text-center shadow-[var(--shadow-xl)]">
                              <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent-primary)] border-t-transparent" />
                              <p className="type-section-title mt-4 text-[var(--text-primary)]">
                                  {t('dashboard.businessSwitcher.switchingTitle')}
                              </p>
                              <p className="type-body mt-2 font-semibold text-[var(--text-primary)]">
                                  {switchingName}
                              </p>
                              <p className="type-caption mt-2 text-[var(--text-muted)]">
                                  {t('dashboard.businessSwitcher.switchingDescription')}
                              </p>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}
        </>
    );
}
