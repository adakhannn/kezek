import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { enUS, ru } from 'date-fns/locale';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import MotionPressable from '../../../components/ui/MotionPressable';
import { colors } from '../../../constants/colors';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import { formatKyDate } from '../../../i18n/kyDate';
import type { Locale } from '../../../i18n/locale';
import { openWebAsCurrentUser } from '../../../lib/webLinks';
import type { RootStackParamList } from '../../../navigation/types';
import { MANAGE_MENU, type ManageRouteParams } from '../manageMenu';
import { useCurrentBusinessReady } from '../opsKit/format';
import { LoadError, SectionTitle, StatTile, ui } from '../opsKit/ui';
import { fetchOverview, homeFocus, onboardingItems, SECTION_WEB_PATH, type DashboardOverview, type DashboardSection } from './overviewData';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Screens of this app for the sections the home links to; others come from the hub menu by key. */
const OWN_SECTION_ROUTES: Partial<Record<DashboardSection, keyof RootStackParamList>> = {
    bookings: 'ManageBookings',
    roleApplications: 'ManageRoleApplications',
};
/** The hub menu key (the website section) of each link. */
const SECTION_MENU_KEY: Record<DashboardSection, string> = {
    bookings: 'bookings',
    staff: 'staff',
    staffNew: 'staff',
    services: 'services',
    servicesNew: 'services',
    branches: 'branches',
    roleApplications: 'roleApplications',
};

function longDate(iso: string, locale: Locale, timeZone: string): string {
    const value = new Date(iso);
    if (locale === 'ky') return formatKyDate(value, { weekday: 'long', day: 'numeric', month: 'long', timeZone });
    const text = formatInTimeZone(value, timeZone, locale === 'en' ? 'EEEE, MMMM d' : 'EEEE, d MMMM', { locale: locale === 'en' ? enUS : ru });
    return text.charAt(0).toUpperCase() + text.slice(1);
}

const METRICS: { key: keyof Pick<DashboardOverview, 'bookingsToday' | 'staffActive' | 'servicesActive' | 'branchesCount'>; title: MobileI18nKey; hint: MobileI18nKey; action: MobileI18nKey; section: DashboardSection; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'bookingsToday', title: 'ops.home.kpi.bookingsToday', hint: 'ops.home.stats.bookingsTodayHint', action: 'ops.home.kpi.openCalendar', section: 'bookings', icon: 'calendar' },
    { key: 'staffActive', title: 'ops.home.kpi.activeStaff', hint: 'ops.home.stats.activeStaffHint', action: 'ops.home.kpi.manageStaff', section: 'staff', icon: 'people' },
    { key: 'servicesActive', title: 'ops.home.kpi.activeServices', hint: 'ops.home.kpi.activeServicesHint', action: 'ops.home.kpi.goToServices', section: 'services', icon: 'clipboard' },
    { key: 'branchesCount', title: 'ops.home.kpi.branches', hint: 'ops.home.kpi.branchesHint', action: 'ops.home.kpi.branchesList', section: 'branches', icon: 'business' },
];

const QUICK_ACTIONS: { key: string; title: MobileI18nKey; hint: MobileI18nKey; emphasis: MobileI18nKey; section: DashboardSection }[] = [
    { key: 'openCalendar', title: 'ops.home.quick.openCalendar', hint: 'ops.home.quick.openCalendarHint', emphasis: 'ops.home.quick.openCalendarEmphasis', section: 'bookings' },
    { key: 'addStaff', title: 'ops.home.quick.addStaff', hint: 'ops.home.quick.addStaffHint', emphasis: 'ops.home.quick.addStaffEmphasis', section: 'staffNew' },
    { key: 'addService', title: 'ops.home.quick.addService', hint: 'ops.home.quick.addServiceHint', emphasis: 'ops.home.quick.addServiceEmphasis', section: 'servicesNew' },
    { key: 'assignServices', title: 'ops.home.quick.assignServices', hint: 'ops.home.quick.assignServicesHint', emphasis: 'ops.home.quick.assignServicesEmphasis', section: 'staff' },
];

const TONE_COLOR = { warning: colors.status.warning, info: colors.status.info, success: colors.status.success } as const;

/** The website's /dashboard: today's numbers, the main focus, quick links, setup steps and the rating formula. */
export default function ManageOverviewScreen() {
    const navigation = useNavigation<Nav>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageOverview'>>();
    const { t, locale } = useLanguage();
    const business = useCurrentBusinessReady(params.bizId);
    const [refreshing, setRefreshing] = useState(false);
    const query = useQuery({
        queryKey: ['manage-overview', params.bizId],
        queryFn: fetchOverview,
        enabled: business.ready,
    });

    const routeParams: ManageRouteParams = { bizId: params.bizId, bizName: params.bizName, tz: params.tz ?? null };
    const openSection = async (section: DashboardSection) => {
        const route = OWN_SECTION_ROUTES[section] ?? MANAGE_MENU.find((item) => item.key === SECTION_MENU_KEY[section])?.route;
        if (route) {
            (navigation.navigate as (name: keyof RootStackParamList, routeParams: ManageRouteParams) => void)(route, routeParams);
            return;
        }
        try {
            await openWebAsCurrentUser(SECTION_WEB_PATH[section]);
        } catch {
            Alert.alert(t('staff.dashboard.webErrorTitle'), t('staff.dashboard.webErrorMessage'));
        }
    };

    if (business.error) return <LoadError title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready || query.isLoading) return <LoadingSpinner message={t('common.loading')} />;
    if (query.error || !query.data) return <LoadError title={t('ops.home.loadError')} onRetry={() => void query.refetch()} />;

    const data = query.data;
    const focus = homeFocus(data);
    const missing = onboardingItems(data);
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };

    return (
        <ScrollView
            style={ui.screen}
            contentContainerStyle={ui.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            testID="manage-overview-screen"
        >
            <Card>
                <Text style={ui.muted}>{t('ops.home.badge')}</Text>
                <Text style={ui.title}>{data.bizName || params.bizName || t('ops.home.defaultBizName')}</Text>
                <Text style={ui.subtitle}>
                    {longDate(data.formattedDate, locale, data.timezone)}{data.bizCity ? ` · ${data.bizCity}` : ''}
                </Text>
                <View style={[ui.tiles, { marginTop: colors.layout.space3 }]}>
                    <StatTile label={t('ops.home.stats.bookingsToday')} value={String(data.bookingsToday)} hint={t('ops.home.stats.bookingsTodayHint')} />
                    <StatTile label={t('ops.home.stats.activeStaff')} value={String(data.staffActive)} hint={t('ops.home.stats.activeStaffHint')} />
                </View>
            </Card>

            <Card style={{ borderLeftWidth: 4, borderLeftColor: TONE_COLOR[focus.tone] }} testID={`overview-focus-${focus.kind}`}>
                <Text style={ui.muted}>{t('ops.home.priority')}</Text>
                <Text style={[ui.sectionTitle, { marginTop: 4 }]}>
                    {t(focus.titleKey)}{focus.count != null ? ` · ${focus.count}` : ''}
                </Text>
                <Text style={[ui.text, { marginTop: 4 }]}>{t(focus.descriptionKey)}</Text>
                <View style={{ marginTop: colors.layout.space3 }}>
                    <Button title={t(focus.ctaKey)} onPress={() => void openSection(focus.section)} variant="primary" fullWidth />
                </View>
            </Card>

            <SectionTitle>{t('ops.home.quick.title')}</SectionTitle>
            <Text style={ui.muted}>{t('ops.home.quick.subtitle')}</Text>
            {QUICK_ACTIONS.map((action) => (
                <MotionPressable
                    key={action.key}
                    onPress={() => void openSection(action.section)}
                    accessibilityRole="button"
                    accessibilityLabel={t(action.title)}
                    accessibilityHint={t(action.hint)}
                    testID={`overview-quick-${action.key}`}
                >
                    <Card padding="md">
                        <Text style={[ui.muted, { color: colors.accent.indigo }]}>{t(action.emphasis)}</Text>
                        <View style={ui.rowBetween}>
                            <Text style={[ui.text, { fontWeight: '600', flexShrink: 1 }]}>{t(action.title)}</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
                        </View>
                        <Text style={ui.muted}>{t(action.hint)}</Text>
                    </Card>
                </MotionPressable>
            ))}

            <SectionTitle>{t('ops.home.metrics')}</SectionTitle>
            <View style={ui.tiles}>
                {METRICS.map((metric) => (
                    <MotionPressable
                        key={metric.key}
                        onPress={() => void openSection(metric.section)}
                        accessibilityRole="button"
                        accessibilityLabel={`${t(metric.title)}: ${data[metric.key]}. ${t(metric.action)}`}
                        style={[ui.tile, { minHeight: 44 }]}
                        testID={`overview-metric-${metric.key}`}
                    >
                        <Ionicons name={metric.icon} size={20} color={colors.accent.indigo} />
                        <Text style={ui.tileValue}>{data[metric.key]}</Text>
                        <Text style={ui.tileLabel}>{t(metric.title)}</Text>
                        <Text style={ui.tileHint}>{t(metric.hint)}</Text>
                        <Text style={[ui.tileHint, { color: colors.accent.indigo }]}>{t(metric.action)}</Text>
                    </MotionPressable>
                ))}
            </View>

            {data.needOnboarding ? (
                <Card testID="overview-onboarding">
                    <Text style={ui.sectionTitle}>{t('ops.home.onboarding.title')}</Text>
                    <Text style={ui.muted}>{t('ops.home.onboarding.summary')} · {t('ops.home.onboarding.remaining', { count: missing.length })}</Text>
                    {missing.map((item, index) => (
                        <View key={item} style={[ui.row, { marginTop: colors.layout.space2, alignItems: 'flex-start' }]}>
                            <Text style={[ui.badgeText, ui.warningText]}>{index + 1}</Text>
                            <Text style={[ui.text, { flexShrink: 1 }]}>{t(item)}</Text>
                        </View>
                    ))}
                </Card>
            ) : null}

            {data.ratingWeights ? (
                <Card testID="overview-rating">
                    <Text style={ui.sectionTitle}>{t('ops.home.rating.title')}</Text>
                    <Text style={ui.muted}>{t('ops.home.rating.subtitle', { days: data.ratingWeights.windowDays })}</Text>
                    {data.ratingConfigScope ? (
                        <Text style={[ui.muted, { marginTop: 4 }]}>
                            {t(data.ratingConfigScope === 'biz' ? 'ops.home.rating.scope.biz' : 'ops.home.rating.scope.global')}
                        </Text>
                    ) : null}
                    <View style={[ui.wrap, { marginTop: colors.layout.space2 }]}>
                        {([
                            ['ops.home.rating.factor.reviews', data.ratingWeights.reviews],
                            ['ops.home.rating.factor.productivity', data.ratingWeights.productivity],
                            ['ops.home.rating.factor.loyalty', data.ratingWeights.loyalty],
                            ['ops.home.rating.factor.discipline', data.ratingWeights.discipline],
                        ] as [MobileI18nKey, number][]).map(([key, value]) => (
                            <View key={key} style={ui.badge}>
                                <Text style={ui.badgeText}>{t(key)}: {value}%</Text>
                            </View>
                        ))}
                    </View>
                    <View style={{ marginTop: colors.layout.space3 }}>
                        {data.ratingScore !== null ? (
                            <View accessible accessibilityLabel={`${t('ops.home.rating.scoreLabel')} ${data.ratingScore.toFixed(1)} / 100`}>
                                <Text style={ui.muted}>{t('ops.home.rating.scoreLabel')}</Text>
                                <Text style={ui.tileValue}>{data.ratingScore.toFixed(1)} <Text style={ui.muted}>/ 100</Text></Text>
                                {data.ratingScore <= 10 ? <Text style={[ui.muted, ui.warningText]}>{t('ops.home.rating.lowRatingHint')}</Text> : null}
                            </View>
                        ) : (
                            <Text style={ui.muted}>{t('ops.home.rating.noRating')}</Text>
                        )}
                        <Text style={[ui.hint, { marginTop: colors.layout.space2 }]}>{t('ops.home.rating.hint')}</Text>
                    </View>
                    <Button
                        title={t('ops.home.rating.moreInfo')}
                        onPress={() => void openWebAsCurrentUser('/docs/RATINGS_HOW_IT_WORKS').catch(() => undefined)}
                        variant="ghost"
                        size="sm"
                    />
                </Card>
            ) : null}
        </ScrollView>
    );
}
