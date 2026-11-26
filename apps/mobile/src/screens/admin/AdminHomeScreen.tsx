import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import Badge, { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import MotionPressable from '../../components/ui/MotionPressable';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import StatTile, { StatGrid } from '../../components/ui/StatTile';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { formatDate, formatTime } from '../../utils/format';
import { adminApi, adminKeys, type AdminOverview, type HomeCountKey } from './adminApi';
import { BOOKING_STATUS_LABELS, bookingStatusTone, todayStatusCounts } from './adminLogic';
import { ADMIN_MENU, type AdminMenuItem } from './adminMenu';
import { AdminQuery } from './adminUi';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const BISHKEK = 'Asia/Bishkek';

/** Grouped thousands without Intl (Hermes may lack it): 12 345. */
export function formatCount(value: number): string {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const STATS: { key: HomeCountKey; label: MobileI18nKey; icon: keyof typeof Ionicons.glyphMap; tone: 'accent' | 'success' | 'warning' | 'info' | 'neutral' | 'danger' }[] = [
    { key: 'businesses', label: 'admin.home.stats.businesses', icon: 'storefront-outline', tone: 'accent' },
    { key: 'branches', label: 'admin.home.stats.branches', icon: 'location-outline', tone: 'success' },
    { key: 'staff', label: 'admin.home.stats.staff', icon: 'people-outline', tone: 'info' },
    { key: 'services', label: 'admin.home.stats.services', icon: 'cut-outline', tone: 'warning' },
    { key: 'bookings', label: 'admin.home.stats.bookings', icon: 'calendar-outline', tone: 'accent' },
    { key: 'categories', label: 'admin.home.stats.categories', icon: 'pricetag-outline', tone: 'neutral' },
];

const CHECKS: { key: keyof AdminOverview['checks']; label: MobileI18nKey }[] = [
    { key: 'serviceRoleKey', label: 'admin.home.systemChecks.serviceRoleKey' },
    { key: 'siteOrigin', label: 'admin.home.systemChecks.siteOrigin' },
    { key: 'supabaseKeys', label: 'admin.home.systemChecks.supabaseKeys' },
];

/** The website's /admin: the panel's sections, platform counts, today's bookings and the newest businesses. */
export default function AdminHomeScreen() {
    const { t } = useLanguage();
    const navigation = useNavigation<Navigation>();
    const [refreshing, setRefreshing] = useState(false);
    const overview = useQuery({ queryKey: adminKeys.overview, queryFn: adminApi.overview });

    const refresh = async () => {
        setRefreshing(true);
        try { await overview.refetch(); } finally { setRefreshing(false); }
    };

    const openSection = (item: AdminMenuItem) => navigation.navigate(item.route as never);

    return (
        <AdminQuery isLoading={overview.isLoading} error={overview.error} onRetry={() => void overview.refetch()} skeleton="hub" testID="admin-home">
            {() => {
                const data = overview.data!;
                const counts = data.counts;
                const failed = new Set((data.failures ?? []).flatMap((failure) => (failure.source === 'count' ? [failure.count] : [])));
                const bookings = data.todayBookings ?? [];
                const latest = data.latestBusinesses ?? [];
                const status = todayStatusCounts(bookings);
                const dayLabel = data.day?.label ? formatDate(new Date(`${data.day.label}T12:00:00+06:00`), t.locale, BISHKEK) : '';
                const failedParts = (data.failures ?? []).filter((failure) => failure.source !== 'count');

                return (
                    <Screen refreshing={refreshing} onRefresh={refresh} testID="admin-home">
                        {!data.configured ? (
                            <FeedbackBanner
                                variant="warning"
                                title={t('admin.home.warnings.env.title')}
                                message={t('admin.home.warnings.env.description')}
                            />
                        ) : null}
                        {failed.size > 0 || failedParts.length > 0 ? (
                            <FeedbackBanner
                                variant="warning"
                                title={t('admin.home.warnings.counts.title')}
                                message={t('admin.home.warnings.unexpected.description')}
                                compact
                            />
                        ) : null}

                        <Section title={t('admin.app.sections')}>
                            <View style={styles.grid} testID="admin-menu">
                                {Array.from({ length: Math.ceil(ADMIN_MENU.length / 2) }, (_, row) => ADMIN_MENU.slice(row * 2, row * 2 + 2)).map((pair) => (
                                    <View key={pair[0].key} style={styles.gridRow}>
                                        {pair.map((item) => (
                                            <View key={item.key} style={styles.gridCell}>
                                                <MotionPressable
                                                    onPress={() => openSection(item)}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={t(item.label)}
                                                    style={styles.tile}
                                                    testID={`admin-menu-${item.key}`}
                                                >
                                                    <View style={styles.tileIcon}>
                                                        <Ionicons name={item.icon} size={18} color={colors.tone.accent.fg} />
                                                    </View>
                                                    <Text style={styles.tileLabel} numberOfLines={2}>{t(item.label)}</Text>
                                                </MotionPressable>
                                            </View>
                                        ))}
                                        {pair.length === 1 ? <View style={styles.gridCell} /> : null}
                                    </View>
                                ))}
                            </View>
                        </Section>

                        <Button
                            title={t('admin.home.createBusiness')}
                            onPress={() => navigation.navigate('AdminBusinessNew')}
                            leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
                            fullWidth
                            testID="admin-create-business"
                        />

                        {counts ? (
                            <Section title={t('admin.home.stats.title')}>
                                <StatGrid columns={2}>
                                    {STATS.map((stat) => (
                                        <StatTile
                                            key={stat.key}
                                            label={t(stat.label)}
                                            value={failed.has(stat.key) ? '—' : formatCount(counts[stat.key])}
                                            icon={stat.icon}
                                            tone={stat.tone}
                                            onPress={stat.key === 'businesses' || stat.key === 'branches'
                                                ? () => navigation.navigate('AdminBusinesses')
                                                : stat.key === 'categories' ? () => navigation.navigate('AdminCategories') : undefined}
                                            testID={`admin-stat-${stat.key}`}
                                        />
                                    ))}
                                </StatGrid>
                            </Section>
                        ) : null}

                        {data.configured ? (
                            <Section title={t('admin.home.bookingsToday.title')} caption={dayLabel || undefined} testID="admin-today">
                                <View style={styles.badges}>
                                    <Badge label={`${t('admin.home.bookingsToday.status.hold')} · ${status.hold}`} tone="warning" />
                                    <Badge label={`${t('admin.home.bookingsToday.status.confirmed')} · ${status.confirmed}`} tone="success" />
                                    <Badge label={`${t('admin.home.bookingsToday.status.cancelled')} · ${status.cancelled}`} tone="danger" />
                                </View>
                                {bookings.length === 0 ? (
                                    <EmptyState icon="calendar-outline" compact title={t('admin.home.bookingsToday.empty')} />
                                ) : (
                                    <ListGroup>
                                        {bookings.map((booking) => (
                                            <ListRow
                                                key={booking.id}
                                                title={`${formatTime(booking.start_at, BISHKEK)}–${formatTime(booking.end_at, BISHKEK)} · ${booking.biz}`}
                                                subtitle={[booking.branch, booking.service, booking.staff, booking.client].filter((part) => part && part !== '—').join(' · ')}
                                                numberOfLines={2}
                                                trailing={<StatusPill label={BOOKING_STATUS_LABELS[booking.status] ? t(BOOKING_STATUS_LABELS[booking.status]) : booking.status} tone={bookingStatusTone(booking.status)} />}
                                                onPress={booking.bizId ? () => navigation.navigate('AdminBusiness', { bizId: booking.bizId!, bizName: booking.biz }) : undefined}
                                                chevron={false}
                                            />
                                        ))}
                                    </ListGroup>
                                )}
                            </Section>
                        ) : null}

                        {data.configured ? (
                            <Section
                                title={t('admin.home.latestBusinesses.title')}
                                actionLabel={t('admin.home.latestBusinesses.all')}
                                onAction={() => navigation.navigate('AdminBusinesses')}
                            >
                                {latest.length === 0 ? (
                                    <EmptyState icon="storefront-outline" compact title={t('admin.home.latestBusinesses.empty')} />
                                ) : (
                                    <ListGroup inset>
                                        {latest.map((business) => (
                                            <ListRow
                                                key={business.id}
                                                icon="storefront-outline"
                                                title={business.name}
                                                subtitle={`/b/${business.slug}`}
                                                value={formatDate(business.created_at, t.locale, BISHKEK)}
                                                onPress={() => navigation.navigate('AdminBusiness', { bizId: business.id, bizName: business.name })}
                                            />
                                        ))}
                                    </ListGroup>
                                )}
                            </Section>
                        ) : null}

                        <Section title={t('admin.home.systemChecks.title')}>
                            <ListGroup inset>
                                {CHECKS.map((check) => {
                                    const ok = data.checks[check.key];
                                    return (
                                        <ListRow
                                            key={check.key}
                                            icon={ok ? 'checkmark-circle' : 'alert-circle'}
                                            iconTone={ok ? 'success' : 'warning'}
                                            title={t(check.label)}
                                            subtitle={ok ? t('admin.app.ok') : t('admin.home.systemChecks.checkEnv')}
                                            chevron={false}
                                        />
                                    );
                                })}
                            </ListGroup>
                        </Section>
                    </Screen>
                );
            }}
        </AdminQuery>
    );
}

const styles = StyleSheet.create({
    grid: { gap: space.sm },
    gridRow: { flexDirection: 'row', gap: space.sm },
    gridCell: { flex: 1 },
    tile: {
        flex: 1,
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radii.lg,
        backgroundColor: colors.surface.card,
    },
    tileIcon: {
        width: 32,
        height: 32,
        borderRadius: radii.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.accent.bg,
    },
    tileLabel: { ...typeScale.callout, fontWeight: '600', color: colors.text.primary, flexShrink: 1 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
