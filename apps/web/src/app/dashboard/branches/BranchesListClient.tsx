'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ToastContainer } from '@/components/ui/Toast';
import QRCodeGenerator from '@/components/QRCodeGenerator';
import { useToast } from '@/hooks/useToast';
import { transliterate } from '@/lib/transliterate';

type Branch = {
    id: string;
    name: string;
    address: string | null;
    is_active: boolean | null;
};

export default function BranchesListClient({
    branches,
    isSuperAdmin,
    businessSlug,
    businessName,
}: {
    branches: Branch[];
    isSuperAdmin: boolean;
    businessSlug: string | null;
    businessName: string | null;
}) {
    const { t, locale } = useLanguage();
    const toast = useToast();
    const [qrCodeData, setQrCodeData] = useState<{ 
        url: string; 
        branchName: string; 
        branchAddress: string | null;
        businessName: string | null;
    } | null>(null);

    function formatText(text: string): string {
        // Транслитерируем текст для английского языка
        if (locale === 'en') {
            return transliterate(text);
        }
        return text;
    }

    function formatAddress(address: string | null): string {
        if (!address) return '—';
        return formatText(address);
    }

    const handleGenerateQR = (branch: Branch) => {
        if (!businessSlug) {
            toast.showError(t('branches.qr.businessInfoError', 'Не удалось получить информацию о бизнесе'));
            return;
        }
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const bookingUrl = `${baseUrl}/b/${businessSlug}/booking?branch=${branch.id}`;
        setQrCodeData({ 
            url: bookingUrl, 
            branchName: branch.name,
            branchAddress: branch.address,
            businessName: businessName,
        });
    };

    return (
        <>
            {qrCodeData && (
                <QRCodeGenerator
                    url={qrCodeData.url}
                    branchName={qrCodeData.branchName}
                    branchAddress={qrCodeData.branchAddress}
                    businessName={qrCodeData.businessName}
                    onClose={() => setQrCodeData(null)}
                />
            )}
        <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            {t('branches.title', 'Филиалы')}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            {t('branches.subtitle', 'Управление филиалами бизнеса')}
                        </p>
                    </div>
                    {isSuperAdmin && (
                        <Link
                            href="/dashboard/branches/new"
                            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                        >
                            <svg
                                className="w-5 h-5 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v16m8-8H4"
                                />
                            </svg>
                            {t('branches.addBranch', 'Добавить филиал')}
                        </Link>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">
                                    {t('branches.table.name', 'Название')}
                                </th>
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">
                                    {t('branches.table.address', 'Адрес')}
                                </th>
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">
                                    {t('branches.table.status', 'Статус')}
                                </th>
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4 w-40">
                                    {t('branches.table.actions', 'Действия')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {branches.map((b) => (
                                <tr
                                    key={b.id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {formatText(b.name)}
                                    </td>
                                    <td className="p-4 text-sm text-gray-700 dark:text-gray-300">
                                        {formatAddress(b.address)}
                                    </td>
                                    <td className="p-4">
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                b.is_active
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                            }`}
                                        >
                                            {b.is_active
                                                ? t('branches.status.active', 'активен')
                                                : t('branches.status.hidden', 'скрыт')}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <Link
                                                href={`/dashboard/branches/${b.id}`}
                                                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                                            >
                                                {/* используем общий короткий ключ, чтобы не плодить новые */}
                                                {t('common.editShort', 'Редакт.')}
                                            </Link>
                                            {businessSlug && (
                                                <button
                                                    onClick={() => handleGenerateQR(b)}
                                                    className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400 transition-all duration-200 flex items-center gap-1"
                                                    title={t('branches.generateQR', 'Сгенерировать QR код')}
                                                >
                                                    <svg
                                                        className="w-4 h-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                                                        />
                                                    </svg>
                                                    QR
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {branches.length === 0 && (
                                <tr>
                                    <td
                                        className="p-8 text-center text-gray-500 dark:text-gray-400"
                                        colSpan={4}
                                    >
                                        {t('branches.empty', 'Пока нет филиалов')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
        </>
    );
}


