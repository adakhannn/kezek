'use client';

import { BookingFilters } from './BookingFilters';
import { BookingsList } from './BookingsList';
import type { BookingItem, BranchRow } from './bookingsViewTypes';
import { useDashboardBookingsListController } from './useDashboardBookingsListController';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

export function DashboardBookingsListSection({
    bizId,
    initial,
    branches,
    timezone,
    notify,
}: {
    bizId: string;
    initial: BookingItem[];
    branches: BranchRow[];
    timezone: string;
    notify: (kind: 'confirm' | 'cancel', id: string) => Promise<void>;
}) {
    const { t, locale } = useLanguage();
    const toast = useToast();
    const {
        list,
        statusFilter,
        branchFilter,
        searchQuery,
        currentPage,
        totalCount,
        activePreset,
        isLoading,
        currentStaffId,
        hasStaffAccess,
        setStatusFilter,
        setBranchFilter,
        setSearchQuery,
        setCurrentPage,
        setActivePreset,
        refresh,
        confirm,
        cancel,
        markAttendance,
        itemsPerPage,
    } = useDashboardBookingsListController({
        bizId,
        initial,
        timezone,
        locale,
        t,
        notify,
        showError: toast.showError,
        showSuccess: toast.showSuccess,
    });

    return (
        <>
            <section className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-3 sm:space-y-4">
                <BookingFilters
                    statusFilter={statusFilter}
                    branchFilter={branchFilter}
                    searchQuery={searchQuery}
                    branches={branches}
                    onStatusChange={setStatusFilter}
                    onBranchChange={setBranchFilter}
                    onSearchChange={setSearchQuery}
                    onRefresh={refresh}
                    isLoading={isLoading}
                    activePreset={activePreset}
                    onPresetChange={setActivePreset}
                    timezone={timezone}
                    currentStaffId={currentStaffId}
                    hasStaffAccess={hasStaffAccess}
                />

                <BookingsList
                    bookings={list}
                    branches={branches}
                    onConfirm={confirm}
                    onCancel={cancel}
                    onMarkAttendance={markAttendance}
                    isLoading={isLoading}
                    currentPage={currentPage}
                    totalCount={totalCount}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                />
            </section>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}
