import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Screen from '../components/ui/Screen';
import { SkeletonCard, SkeletonList } from '../components/ui/Skeleton';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';
import { useNow } from '../hooks/useNow';
import { useLanguage, type MobileI18nKey } from '../i18n';
import { getErrorMessage } from '../lib/errors';
import { openWebAsCurrentUser } from '../lib/webLinks';
import type { RootStackParamList } from '../navigation/types';
import { DashboardScreenSections } from './dashboard/DashboardScreenSections';
import { ensureCurrentBusiness } from './manage/currentBusiness';
import type { ManageMenuItem, ManageRouteParams } from './manage/manageMenu';
import type { ManagerBooking, ManagerBookingAction } from './dashboard/types';
import { useDashboardScreenData } from './dashboard/useDashboardScreenData';

const ACTION_DONE: Record<ManagerBookingAction, MobileI18nKey> = {
    confirm: 'manager.action.confirmed',
    cancel: 'manager.action.cancelled',
    attended: 'manager.action.markedAttended',
    no_show: 'manager.action.markedNoShow',
};

export default function DashboardScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const { now } = useNow();
    const data = useDashboardScreenData();

    // The shape of the hub while the businesses load: the business card, the section tiles, the list.
    if (data.isLoading) {
        return (
            <Screen tabBar testID="dashboard-loading">
                <SkeletonCard lines={2} />
                <SkeletonCard lines={4} />
                <SkeletonList rows={3} avatar={false} />
            </Screen>
        );
    }

    if (data.loadError) {
        return (
            <Screen tabBar refreshing={data.refreshing} onRefresh={data.onRefresh}>
                <ErrorState
                    title={t('staff.dashboard.loadError')}
                    message={t('staff.checkConnection')}
                    retryLabel={t('staff.retry')}
                    onRetry={() => void data.onRefresh()}
                />
            </Screen>
        );
    }

    if (!data.isOwner) {
        return (
            <Screen tabBar refreshing={data.refreshing} onRefresh={data.onRefresh}>
                <EmptyState
                    icon="business-outline"
                    title={t('staff.dashboard.notOwnerTitle')}
                    message={t('staff.dashboard.notOwnerMessage')}
                />
            </Screen>
        );
    }

    const openWebDashboard = async () => {
        try {
            await openWebAsCurrentUser('/select-business');
        } catch {
            Alert.alert(
                t('staff.dashboard.webErrorTitle'),
                t('staff.dashboard.webErrorMessage'),
            );
        }
    };

    // A management section works on the web cabinet's current business: the one chosen here is
    // made current first, so the screen and the website act on the same business.
    const openManage = async (item: ManageMenuItem) => {
        const business = data.business;
        if (!business) return;
        try {
            await ensureCurrentBusiness(business.id);
            const params: ManageRouteParams = { bizId: business.id, bizName: business.name, tz: business.tz ?? null };
            // Every ManageRoute takes exactly ManageRouteParams (see manageMenu.ts).
            (navigation.navigate as (route: ManageMenuItem["route"], routeParams: ManageRouteParams) => void)(item.route, params);
        } catch (error) {
            showToast(getErrorMessage(error, t('manager.manage.selectError'), t), 'error');
        }
    };

    // Cancelling and marking attendance cannot be undone in the app: both ask first.
    const handleAction = async (booking: ManagerBooking, action: ManagerBookingAction) => {
        if (action === 'cancel') {
            const accepted = await confirm({
                title: t('manager.cancelConfirm.title'),
                message: t('manager.cancelConfirm.message'),
                confirmLabel: t('manager.cancelConfirm.confirm'),
                cancelLabel: t('manager.cancelConfirm.keep'),
                variant: 'danger',
            });
            if (!accepted) return;
        } else if (action === 'attended' || action === 'no_show') {
            const accepted = await confirm({
                title: t('manager.attendanceConfirm.title'),
                message: t(action === 'attended' ? 'manager.attendanceConfirm.attended' : 'manager.attendanceConfirm.noShow'),
                confirmLabel: t(action === 'attended' ? 'manager.action.attended' : 'manager.action.noShow'),
                cancelLabel: t('manager.attendanceConfirm.back'),
                variant: action === 'no_show' ? 'danger' : undefined,
            });
            if (!accepted) return;
        }
        try {
            await data.runAction(booking.id, action);
            showToast(t(ACTION_DONE[action]), 'success');
        } catch (error) {
            showToast(getErrorMessage(error, t('manager.action.error'), t), 'error');
        }
    };

    return (
        <DashboardScreenSections
            businesses={data.businesses}
            business={data.business}
            onSelectBusiness={(bizId) => {
                data.selectBusiness(bizId).catch((error: unknown) =>
                    showToast(getErrorMessage(error, t('parity.selectBusiness.error'), t), 'error'));
            }}
            scope={data.scope}
            onScopeChange={data.setScope}
            bookings={data.bookings}
            timezone={data.timezone}
            now={now}
            bookingsLoading={data.bookingsLoading}
            bookingsError={data.bookingsError}
            hasMore={data.hasMore}
            isLoadingMore={data.isLoadingMore}
            onLoadMore={data.loadMore}
            onRetryBookings={data.retryBookings}
            pendingBookingId={data.pendingBookingId}
            onAction={(booking, action) => void handleAction(booking, action)}
            // B1: a manager reads any booking of their business (viewer_role 'manager').
            onOpenBooking={(id) => navigation.navigate('BookingDetails', { id })}
            refreshing={data.refreshing}
            onRefresh={data.onRefresh}
            onOpenWeb={() => void openWebDashboard()}
            onOpenManage={(item) => void openManage(item)}
        />
    );
}
