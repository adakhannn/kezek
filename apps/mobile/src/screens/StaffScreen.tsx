import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Screen from '../components/ui/Screen';
import { SkeletonBlock, SkeletonCard, SkeletonList } from '../components/ui/Skeleton';
import { useLanguage } from '../i18n';
import { getErrorMessage } from '../lib/errors';
import { RootStackParamList } from '../navigation/types';
import { StaffBusinessPicker } from './staff/StaffBusinessPicker';
import { StaffScreenSections } from './staff/StaffScreenSections';
import { useStaffScreenData } from './staff/useStaffScreenData';
import { useStaffServices } from './staff/useStaffServices';

type StaffScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function StaffScreen() {
    const navigation = useNavigation<StaffScreenNavigationProp>();
    const { t } = useLanguage();
    const {
        staffInfo,
        staffRecords,
        needsSelection,
        selectStaff,
        tab,
        setTab,
        bookings,
        loadError,
        isLoading,
        refreshing,
        onRefresh,
    } = useStaffScreenData();
    const staffServices = useStaffServices(staffInfo?.id);
    const [choosingBusiness, setChoosingBusiness] = useState(false);
    const [selectingId, setSelectingId] = useState<string | null>(null);
    const [selectionError, setSelectionError] = useState<string | null>(null);

    const handleSelectBusiness = async (staffId: string) => {
        if (selectingId) return;
        setSelectingId(staffId);
        setSelectionError(null);
        try {
            await selectStaff(staffId);
            setChoosingBusiness(false);
        } catch (error) {
            setSelectionError(getErrorMessage(error, t('staff.workspace.selectError'), t));
        } finally {
            setSelectingId(null);
        }
    };

    if (isLoading) {
        return (
            <Screen tabBar testID="staff-screen-loading">
                <SkeletonBlock width={88} height={88} radius={44} />
                <SkeletonBlock height={52} />
                <SkeletonList rows={3} avatar={false} />
                <SkeletonCard lines={2} />
            </Screen>
        );
    }

    if (loadError) {
        return (
            <Screen tabBar refreshing={refreshing} onRefresh={onRefresh}>
                <ErrorState title={t('staff.workspace.loadError')} onRetry={() => void onRefresh()} />
            </Screen>
        );
    }

    if (needsSelection || (choosingBusiness && staffRecords.length > 1)) {
        return (
            <StaffBusinessPicker
                records={staffRecords}
                currentId={staffInfo?.id ?? null}
                selectingId={selectingId}
                error={selectionError}
                refreshing={refreshing}
                onRefresh={onRefresh}
                onSelect={(staffId) => void handleSelectBusiness(staffId)}
                onCancel={
                    staffInfo
                        ? () => {
                              setChoosingBusiness(false);
                              setSelectionError(null);
                          }
                        : undefined
                }
            />
        );
    }

    if (!staffInfo) {
        return (
            <Screen tabBar refreshing={refreshing} onRefresh={onRefresh}>
                <EmptyState
                    icon="briefcase-outline"
                    title={t('staff.notStaff')}
                    message={t('staff.workspace.notStaffMessage')}
                />
            </Screen>
        );
    }

    return (
        <StaffScreenSections
            staffInfo={staffInfo}
            list={{
                tab,
                onTabChange: setTab,
                bookings: bookings.bookings,
                isLoading: bookings.isLoading,
                error: bookings.error,
                hasMore: bookings.hasMore,
                isLoadingMore: bookings.isLoadingMore,
                onLoadMore: bookings.loadMore,
                onRetry: () => void bookings.refetch(),
                // B1: the master reads their own booking (viewer_role 'staff').
                onOpenBooking: (id) => navigation.navigate('BookingDetails', { id }),
            }}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onOpenShiftQuick={() => navigation.navigate('ShiftQuick')}
            onOpenShifts={() => navigation.navigate('Shifts')}
            onOpenSchedule={() => navigation.navigate('StaffSchedule')}
            onCreateBooking={() => navigation.navigate('StaffCreateBooking')}
            services={staffServices.data}
            onChangeBusiness={
                staffRecords.length > 1
                    ? () => {
                          setSelectionError(null);
                          setChoosingBusiness(true);
                      }
                    : undefined
            }
        />
    );
}
