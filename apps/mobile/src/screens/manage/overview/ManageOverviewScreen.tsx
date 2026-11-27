import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { enUS, ru } from 'date-fns/locale';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import ListRow, { KeyValueRow, ListGroup } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import StatTile, { StatGrid } from '../../../components/ui/StatTile';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale } from '../../../constants/theme';
import { translatePlural, useLanguage, type MobileI18nKey } from '../../../i18n';
import { formatKyDate } from '../../../i18n/kyDate';
import type { Locale } from '../../../i18n/locale';
import { openWebAsCurrentUser } from '../../../lib/webLinks';
import type { RootStackParamList } from '../../../navigation/types';
import { MANAGE_MENU, type ManageRouteParams } from '../manageMenu';
import { useCurrentBusinessReady } from '../opsKit/format';
import { LoadError, ScreenSkeleton, ui } from '../opsKit/ui';
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

const QUICK_ACTIONS: { key: string; title: MobileI18nKey; hint: MobileI18nKey; section: DashboardSection; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'openCalendar', title: 'ops.home.quick.openCalendar', hint: 'ops.home.quick.openCalendarHint', section: 'bookings', icon: 'calendar-outline' },
    { key: 'addStaff', title: 'ops.home.quick.addStaff', hint: 'ops.home.quick.addStaffHint', section: 'staffNew', icon: 'person-add-outline' },
    { key: 'addService', title: 'ops.home.quick.addService', hint: 'ops.home.quick.addServiceHint', section: 'servicesNew', icon: 'add-circle-outline' },
    { key: 'assignServices', title: 'ops.home.quick.assignServices', hint: 'ops.home.quick.assignServicesHint', section: 'staff', icon: 'git-network-outline' },
];

const FOCUS_ICON = { warning: 'alert-circle', info: 'information-circle', success: 'checkmark-circle' } as const;

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

    if (business.error) return <LoadError screen title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready || query.isLoading) return <ScreenSkeleton testID="manage-overview-loading" />;
    if (query.error || !query.data) return <LoadError screen title={t('ops.home.loadError')} onRetry={() => void query.refetch()} />;

    const data = query.data;
    const focus = homeFocus(data);
    const missing = onboardingItems(data);
    const tone = colors.tone[focus.tone];
    const weights = data.ratingWeights;
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="manage-overview-screen">
            {/* The header says "Главная": the business and its day open the page, then today's numbers. */}
            <View style={styles.hero}>
                <Text style={styles.heroName} numberOfLines={2}>{data.bizName || params.bizName || t('ops.home.defaultBizName')}</Text>
                <ScreenIntro>{`${longDate(data.formattedDate, locale, data.timezone)}${data.bizCity ? ` · ${data.bizCity}` : ''}`}</ScreenIntro>
            </View>

            <StatGrid>
                {METRICS.map((metric) => (
                    <StatTile
                        key={metric.key}
                        icon={metric.icon}
                        tone={metric.key === 'bookingsToday' ? 'accent' : undefined}
                        label={t(metric.title)}
                        value={String(data[metric.key])}
                        hint={t(metric.hint)}
                        onPress={() => void openSection(metric.section)}
                        testID={`overview-metric-${metric.key}`}
                    />
                ))}
            </StatGrid>

            <Card variant="plain" padding="md" style={styles.focus} testID={`overview-focus-${focus.kind}`}>
                <View style={styles.focusHead}>
                    <View style={[styles.focusIcon, { backgroundColor: tone.bg }]}>
                        <Ionicons name={FOCUS_ICON[focus.tone]} size={20} color={tone.fg} />
                    </View>
                    <Text style={[ui.overline, { color: tone.fg }]}>{t('ops.home.priority')}</Text>
                </View>
                <Text style={styles.focusTitle} accessibilityRole="header">
                    {t(focus.titleKey)}{focus.count != null ? ` · ${focus.count}` : ''}
                </Text>
                <Text style={ui.muted}>{t(focus.descriptionKey)}</Text>
                <Button title={t(focus.ctaKey)} onPress={() => void openSection(focus.section)} fullWidth style={styles.focusButton} />
            </Card>

            <Section title={t('ops.home.quick.title')}>
                <ListGroup inset>
                    {QUICK_ACTIONS.map((action) => (
                        <ListRow
                            key={action.key}
                            icon={action.icon}
                            title={t(action.title)}
                            subtitle={t(action.hint)}
                            onPress={() => void openSection(action.section)}
                            testID={`overview-quick-${action.key}`}
                        />
                    ))}
                </ListGroup>
            </Section>

            {data.needOnboarding ? (
                <Section
                    title={t('ops.home.onboarding.title')}
                    caption={`${t('ops.home.onboarding.summary')} · ${t('ops.home.onboarding.remaining', { count: missing.length })}`}
                    testID="overview-onboarding"
                >
                    <ListGroup inset>
                        {missing.map((item, index) => (
                            <ListRow
                                key={item}
                                leading={(
                                    <View style={styles.stepNumber}>
                                        <Text style={styles.stepNumberText}>{index + 1}</Text>
                                    </View>
                                )}
                                title={t(item)}
                                numberOfLines={2}
                            />
                        ))}
                    </ListGroup>
                </Section>
            ) : null}

            {weights ? (
                <Section
                    title={t('ops.home.rating.title')}
                    caption={t('ops.home.rating.subtitle', { period: translatePlural(t, 'common.days', weights.windowDays) })}
                    actionLabel={t('ops.home.rating.moreInfo')}
                    onAction={() => void openWebAsCurrentUser('/docs/RATINGS_HOW_IT_WORKS').catch(() => undefined)}
                    testID="overview-rating"
                >
                    <Card variant="plain" padding="md">
                        {data.ratingScore !== null ? (
                            <View accessible accessibilityLabel={`${t('ops.home.rating.scoreLabel')} ${data.ratingScore.toFixed(1)} / 100`} style={styles.score}>
                                <Text style={ui.muted}>{t('ops.home.rating.scoreLabel')}</Text>
                                <Text style={styles.scoreValue}>
                                    {data.ratingScore.toFixed(1)}<Text style={styles.scoreMax}> / 100</Text>
                                </Text>
                                {data.ratingScore <= 10 ? <Text style={[ui.muted, styles.warning]}>{t('ops.home.rating.lowRatingHint')}</Text> : null}
                            </View>
                        ) : (
                            <Text style={[ui.muted, styles.score]}>{t('ops.home.rating.noRating')}</Text>
                        )}
                        <View style={ui.separator} />
                        {([
                            ['ops.home.rating.factor.reviews', weights.reviews],
                            ['ops.home.rating.factor.productivity', weights.productivity],
                            ['ops.home.rating.factor.loyalty', weights.loyalty],
                            ['ops.home.rating.factor.discipline', weights.discipline],
                        ] as [MobileI18nKey, number][]).map(([key, value]) => (
                            <KeyValueRow key={key} label={t(key)} value={`${value}%`} />
                        ))}
                        {data.ratingConfigScope ? (
                            <Text style={[ui.hint, styles.ratingNote]}>
                                {t(data.ratingConfigScope === 'biz' ? 'ops.home.rating.scope.biz' : 'ops.home.rating.scope.global')}
                            </Text>
                        ) : null}
                        <Text style={[ui.hint, styles.ratingNote]}>{t('ops.home.rating.hint')}</Text>
                    </Card>
                </Section>
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    hero: { gap: space.xs },
    heroName: { ...typeScale.title, color: colors.text.primary },
    // One card level, no outline: the tinted icon and the overline carry the tone.
    focus: { gap: space.sm },
    focusHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    focusIcon: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
    focusTitle: { ...typeScale.headline, color: colors.text.primary },
    focusButton: { marginTop: space.sm },
    stepNumber: {
        width: 36,
        height: 36,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.warning.bg,
    },
    stepNumberText: { ...typeScale.callout, fontWeight: '700', color: colors.tone.warning.fg },
    score: { gap: space.xxs, paddingBottom: space.md },
    scoreValue: { ...typeScale.display, color: colors.text.primary },
    scoreMax: { ...typeScale.headline, color: colors.text.tertiary },
    warning: { color: colors.tone.warning.fg },
    ratingNote: { marginTop: space.sm },
});
