import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import SegmentedTabs from '../../../components/SegmentedTabs';
import { colors } from '../../../constants/colors';
import { layout, space } from '../../../constants/theme';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { useCurrentBusinessReady } from '../opsKit/format';
import { LoadError, ScreenSkeleton } from '../opsKit/ui';
import BookingsCalendarTab from './BookingsCalendarTab';
import { fetchBookingOptions } from './bookingsData';
import BookingsListTab from './BookingsListTab';
import QuickDeskTab from './QuickDeskTab';

export type BookingsTab = 'calendar' | 'list' | 'desk';

/**
 * The website's /dashboard/bookings: the day calendar by master, the list with search, filters,
 * presets and status actions, and QuickDesk (an internal booking for a client at the desk).
 */
export default function ManageBookingsScreen() {
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageBookings'>>();
    const { t } = useLanguage();
    const [tab, setTab] = useState<BookingsTab>('calendar');
    const business = useCurrentBusinessReady(params.bizId);
    const timezone = resolveBusinessTimeZone(params.tz);
    const options = useQuery({
        queryKey: ['manage-booking-options', params.bizId],
        queryFn: () => fetchBookingOptions(params.bizId),
        enabled: business.ready,
    });

    if (business.error) return <LoadError screen title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready || options.isLoading) return <ScreenSkeleton testID="manage-bookings-loading" />;
    if (options.error || !options.data) return <LoadError screen title={t('ops.bookings.optionsError')} onRetry={() => void options.refetch()} />;

    return (
        <View style={styles.page} testID="manage-bookings-screen">
            {/* The tabs stay on top; each tab scrolls under them with the page gutter. */}
            <View style={styles.tabs}>
                <SegmentedTabs
                    tabs={[
                        { key: 'calendar', label: t('ops.bookings.tabs.calendar') },
                        { key: 'list', label: t('ops.bookings.tabs.list') },
                        { key: 'desk', label: t('ops.bookings.tabs.desk') },
                    ]}
                    value={tab}
                    onChange={setTab}
                    testID="manage-bookings-tabs"
                />
            </View>
            {tab === 'calendar' ? (
                <BookingsCalendarTab bizId={params.bizId} timezone={timezone} options={options.data} />
            ) : tab === 'list' ? (
                <BookingsListTab bizId={params.bizId} timezone={timezone} branches={options.data.branches} />
            ) : (
                <QuickDeskTab bizId={params.bizId} timezone={timezone} options={options.data} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.surface.page },
    tabs: { paddingHorizontal: layout.gutter, paddingTop: space.md },
});
