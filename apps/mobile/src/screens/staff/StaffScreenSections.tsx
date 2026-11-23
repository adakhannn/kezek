import { RefreshControl, ScrollView, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { useLanguage } from '../../i18n';
import { formatDate, formatTime } from '../../utils/format';
import { styles } from './staffScreenStyles';
import type { StaffInfo, UpcomingBooking } from './types';

type Props = {
    staffInfo: StaffInfo;
    upcomingBookings: UpcomingBooking[];
    refreshing: boolean;
    onRefresh: () => Promise<void>;
    onOpenShiftQuick: () => void;
    onOpenShifts: () => void;
    /** Shown when the person works in several businesses. */
    onChangeBusiness?: () => void;
};

export function StaffScreenSections({
    staffInfo,
    upcomingBookings,
    refreshing,
    onRefresh,
    onOpenShiftQuick,
    onOpenShifts,
    onChangeBusiness,
}: Props) {
    const { t, locale } = useLanguage();
    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="staff-screen"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>{t('staff.workspace.title')}</Text>
                <Text style={styles.subtitle}>{staffInfo.full_name}</Text>
            </View>

            {staffInfo.branch && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('staff.workspace.branch')}</Text>
                    <Text style={styles.branchName}>{staffInfo.branch.name}</Text>
                </Card>
            )}

            {(staffInfo.business || onChangeBusiness) && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('staff.workspace.business')}</Text>
                    {staffInfo.business ? (
                        <Text style={styles.businessName}>{staffInfo.business.name}</Text>
                    ) : null}
                    {onChangeBusiness ? (
                        <Button
                            title={t('staff.workspace.changeBusiness')}
                            onPress={onChangeBusiness}
                            variant="outline"
                            fullWidth
                            accessibilityHint={t('staff.workspace.changeBusinessHint')}
                            style={staffInfo.business ? styles.changeBusinessAction : undefined}
                        />
                    ) : null}
                </Card>
            )}

            <View style={styles.section}>
                <Button title={t('staff.myShift')} onPress={onOpenShiftQuick} fullWidth />
                <Button
                    title={t('staff.workspace.stats')}
                    onPress={onOpenShifts}
                    variant="outline"
                    fullWidth
                    style={styles.secondaryAction}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('staff.workspace.upcoming')}</Text>

                {upcomingBookings.length > 0 ? (
                    <View style={styles.bookingsList}>
                        {upcomingBookings.map((booking) => (
                            <Card key={booking.id} style={styles.bookingCard}>
                                <Text style={styles.bookingService}>
                                    {booking.service?.name_ru || t('staff.service')}
                                </Text>
                                {booking.client_name && (
                                    <Text style={styles.bookingClient}>
                                        {t('staff.workspace.bookingClient', { name: booking.client_name })}
                                    </Text>
                                )}
                                {booking.client_phone && (
                                    <Text style={styles.bookingPhone}>{booking.client_phone}</Text>
                                )}
                                <View style={styles.bookingTime}>
                                    <Text style={styles.bookingDate}>{formatDate(booking.start_at, locale)}</Text>
                                    <Text style={styles.bookingTimeRange}>
                                        {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                                    </Text>
                                </View>
                            </Card>
                        ))}
                    </View>
                ) : (
                    <EmptyState
                        icon="calendar"
                        title={t('staff.workspace.emptyTitle')}
                        message={t('staff.workspace.emptyMessage')}
                    />
                )}
            </View>
        </ScrollView>
    );
}

