import { RefreshControl, ScrollView, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import MotionPressable from '../../components/ui/MotionPressable';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { formatDate, formatTime } from '../../utils/format';
import { getStatusColor, getStatusText } from '../../utils/i18n';
import { styles } from './cabinetScreenStyles';
import type { Booking } from './types';

type Props = {
    userLabel: string;
    activeTab: 'upcoming' | 'history';
    isOfflineData: boolean;
    lastSyncAt: string | null;
    upcomingBookings: Booking[];
    pastBookings: Booking[];
    refreshing: boolean;
    onTabChange: (tab: 'upcoming' | 'history') => void;
    onRefresh: () => Promise<void>;
    onBookingPress: (bookingId: string) => void;
    onProfilePress: () => void;
};

export function CabinetScreenSections({
    userLabel,
    activeTab,
    isOfflineData,
    lastSyncAt,
    upcomingBookings,
    pastBookings,
    refreshing,
    onTabChange,
    onRefresh,
    onBookingPress,
    onProfilePress,
}: Props) {
    const isHistory = activeTab === 'history';
    const visibleBookings = isHistory ? pastBookings : upcomingBookings;

    return (
        <ScrollView
            style={styles.container}
            testID="cabinet-screen"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Р›РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚</Text>
                <Text style={styles.subtitle}>{userLabel}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>РњРѕРё Р·Р°РїРёСЃРё</Text>

                <View style={styles.tabsContainer}>
                    <MotionPressable
                        style={[styles.tabButton, activeTab === 'upcoming' && styles.tabButtonActive]}
                        onPress={() => onTabChange('upcoming')}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'upcoming' && styles.tabButtonTextActive]}>
                            РџСЂРµРґСЃС‚РѕСЏС‰РёРµ
                        </Text>
                    </MotionPressable>
                    <MotionPressable
                        style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
                        onPress={() => onTabChange('history')}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}>
                            РСЃС‚РѕСЂРёСЏ
                        </Text>
                    </MotionPressable>
                </View>

                {isOfflineData ? (
                    <OfflineBanner
                        message={`РќРµС‚ РїРѕРґРєР»СЋС‡РµРЅРёСЏ Рє РёРЅС‚РµСЂРЅРµС‚Сѓ вЂ” РїРѕРєР°Р·Р°РЅС‹ СЃРѕС…СЂР°РЅС‘РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ${
                            lastSyncAt ? ` (РїРѕСЃР»РµРґРЅСЏСЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ: ${formatDate(lastSyncAt)} ${formatTime(lastSyncAt)})` : ''
                        }`}
                    />
                ) : null}

                {visibleBookings.length > 0 ? (
                    <View style={styles.bookingsList}>
                        {visibleBookings.map((booking) => (
                            <MotionPressable
                                key={booking.id}
                                onPress={() => onBookingPress(booking.id)}
                                style={styles.bookingPressable}
                                scale="firm"
                            >
                                <BookingCard booking={booking} />
                            </MotionPressable>
                        ))}
                    </View>
                ) : (
                    <EmptyState
                        compact
                        title={isHistory ? 'РЈ РІР°СЃ РїРѕРєР° РЅРµС‚ РїСЂРѕС€РµРґС€РёС… Р·Р°РїРёСЃРµР№' : 'РЈ РІР°СЃ РїРѕРєР° РЅРµС‚ Р·Р°РїРёСЃРµР№'}
                        message={
                            isHistory
                                ? 'Р—РґРµСЃСЊ РїРѕСЏРІСЏС‚СЃСЏ Р·Р°РІРµСЂС€С‘РЅРЅС‹Рµ Р·Р°РїРёСЃРё РїРѕСЃР»Рµ РїРµСЂРІРѕР№ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё'
                                : 'Р—Р°РїРёС€РёС‚РµСЃСЊ РЅР° СѓСЃР»СѓРіСѓ, С‡С‚РѕР±С‹ СѓРІРёРґРµС‚СЊ РµС‘ Р·РґРµСЃСЊ'
                        }
                        style={styles.empty}
                    />
                )}
            </View>

            <View style={styles.footer}>
                <Button title="РџСЂРѕС„РёР»СЊ" onPress={onProfilePress} variant="outline" fullWidth />
            </View>
        </ScrollView>
    );
}

function BookingCard({ booking }: { booking: Booking }) {
    return (
        <Card style={styles.bookingCard}>
            <View style={styles.bookingHeader}>
                <Text style={styles.bookingService}>{booking.service?.name_ru || 'РЈСЃР»СѓРіР°'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
                </View>
            </View>

            {booking.business ? <Text style={styles.bookingBusiness}>{booking.business.name}</Text> : null}
            {booking.staff ? <Text style={styles.bookingStaff}>РњР°СЃС‚РµСЂ: {booking.staff.full_name}</Text> : null}
            {booking.branch ? (
                <Text style={styles.bookingBranch}>
                    {booking.branch.name}
                    {booking.branch.address ? ` вЂў ${booking.branch.address}` : ''}
                </Text>
            ) : null}

            <View style={styles.bookingTime}>
                <Text style={styles.bookingDate}>{formatDate(booking.start_at)}</Text>
                <Text style={styles.bookingTimeRange}>
                    {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                </Text>
            </View>
        </Card>
    );
}
