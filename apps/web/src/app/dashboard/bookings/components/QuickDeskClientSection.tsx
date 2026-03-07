'use client';

import { useState } from 'react';

import { SellVisitPackageModal } from './SellVisitPackageModal';
import type { QuickDeskClientMode } from './useQuickDeskClient';
import type { FoundUser } from './useQuickDeskClient';

type TranslateFn = (key: string, fallback: string) => string;

type QuickDeskClientSectionProps = {
    clientMode: QuickDeskClientMode;
    setClientMode: (mode: QuickDeskClientMode) => void;
    searchQ: string;
    setSearchQ: (q: string) => void;
    foundUsers: FoundUser[];
    selectedClientId: string;
    setSelectedClientId: (id: string) => void;
    newClientName: string;
    setNewClientName: (v: string) => void;
    newClientPhone: string;
    setNewClientPhone: (v: string) => void;
    searchLoading: boolean;
    searchErr: string | null;
    t: TranslateFn;
};

export function QuickDeskClientSection({
    clientMode,
    setClientMode,
    searchQ,
    setSearchQ,
    foundUsers,
    selectedClientId,
    setSelectedClientId,
    newClientName,
    setNewClientName,
    newClientPhone,
    setNewClientPhone,
    searchLoading,
    searchErr,
    t,
}: QuickDeskClientSectionProps) {
    const [showSellPackageModal, setShowSellPackageModal] = useState(false);
    const selectedClient = foundUsers.find((u) => u.id === selectedClientId);
    const canSellPackage = clientMode === 'existing' && selectedClientId && selectedClient;

    const modeBtn = (mode: QuickDeskClientMode, labelKey: string, hintKey: string) => (
        <button
            type="button"
            onClick={() => setClientMode(mode)}
            className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                clientMode === mode
                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
        >
            <span className="font-medium text-gray-900 dark:text-gray-100">{t(labelKey, '')}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{t(hintKey, '')}</span>
        </button>
    );

    return (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('bookings.desk.client', 'Клиент')}
            </h3>
            <div className="grid grid-cols-3 gap-2">
                {modeBtn('none', 'bookings.desk.clientNone', 'bookings.desk.clientNone.hint')}
                {modeBtn('existing', 'bookings.desk.clientExisting', 'bookings.desk.clientExisting.hint')}
                {modeBtn('new', 'bookings.desk.clientNew', 'bookings.desk.clientNew.hint')}
            </div>

            {clientMode === 'existing' && (
                <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('bookings.desk.clientExisting.searchHint', '')}
                    </p>
                    <input
                        type="search"
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        placeholder={t('bookings.desk.searchPlaceholder', '')}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                    {searchLoading && (
                        <p className="text-xs text-gray-500">{t('bookings.desk.searching', '')}</p>
                    )}
                    {searchErr && <p className="text-xs text-red-600 dark:text-red-400">{searchErr}</p>}
                    {foundUsers.length > 0 && (
                        <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-gray-200 dark:border-gray-700">
                            {foundUsers.map((u) => (
                                <li key={u.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedClientId(u.id)}
                                        className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                                            selectedClientId === u.id
                                                ? 'bg-indigo-100 dark:bg-indigo-900/30'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {u.full_name}
                                        {(u.phone || u.email) && (
                                            <span className="ml-1 text-xs text-gray-500">
                                                {[u.phone, u.email].filter(Boolean).join(' · ')}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {selectedClientId && foundUsers.some((u) => u.id === selectedClientId) && (
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs text-green-600 dark:text-green-400">
                                {t('bookings.desk.clientMode.found', '')}
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowSellPackageModal(true)}
                                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                {t('dashboard.visitPackages.sell.button', 'Продать пакет')}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {canSellPackage && selectedClient && (
                <SellVisitPackageModal
                    isOpen={showSellPackageModal}
                    onClose={() => setShowSellPackageModal(false)}
                    clientId={selectedClientId}
                    clientName={selectedClient.full_name}
                    onSuccess={() => setShowSellPackageModal(false)}
                />
            )}

            {clientMode === 'new' && (
                <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('bookings.desk.clientNew.formHint', '')}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <input
                            type="text"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            placeholder={t('bookings.desk.clientName', '')}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        />
                        <input
                            type="tel"
                            value={newClientPhone}
                            onChange={(e) => setNewClientPhone(e.target.value)}
                            placeholder={t('bookings.desk.clientPhone', '')}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
