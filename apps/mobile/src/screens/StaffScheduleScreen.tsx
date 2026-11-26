import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Badge, { StatusPill } from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { ListGroup } from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import Section from '../components/ui/Section';
import { SkeletonList } from '../components/ui/Skeleton';
import { colors } from '../constants/colors';
import { radii, space, typeScale } from '../constants/theme';
import { useLanguage, type MobileI18nKey } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { isoWeekdayOfYmd } from '../utils/businessWeek';
import { useStaffScheduleData, type ScheduleDayView, type TimeRange } from './staffSchedule/useStaffScheduleData';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'StaffSchedule'>;

const dmy = (ymd: string) => `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}.${ymd.slice(0, 4)}`;
const rangeText = (items: TimeRange[]) => items.map((item) => `${item.start}–${item.end}`).join(', ');

/** The master's own working hours this week and next, read-only, like the website's /staff/schedule (S3). */
export default function StaffScheduleScreen() {
    const navigation = useNavigation<Navigation>();
    const { t } = useLanguage();
    const data = useStaffScheduleData();

    if (data.staffLoading || (data.isLoading && !data.days)) {
        return (
            <Screen testID="staff-schedule-loading">
                <SkeletonList rows={7} avatar={false} />
            </Screen>
        );
    }

    if (data.needsSelection) {
        return (
            <Screen>
                <EmptyState
                    icon="briefcase-outline"
                    title={t('staff.chooseBusinessOnTab', { tab: t('nav.staffTab') })}
                    action={
                        <Button
                            title={t('staff.openTab', { tab: t('nav.staffTab') })}
                            onPress={() => navigation.navigate('Main', { screen: 'Staff' })}
                            fullWidth
                        />
                    }
                />
            </Screen>
        );
    }

    if (!data.staff) {
        return (
            <Screen>
                <EmptyState icon="briefcase-outline" title={t('staff.notStaff')} message={t('staff.workspace.notStaffMessage')} />
            </Screen>
        );
    }

    if (data.error && !data.days) {
        return (
            <Screen refreshing={data.refreshing} onRefresh={data.onRefresh}>
                <ErrorState title={t('staff.schedule.loadError')} onRetry={() => void data.onRefresh()} />
            </Screen>
        );
    }

    const homeBranchId = data.staff.branch?.id ?? null;
    const branchName = (id: string | null) => (id ? data.branchNames.get(id) ?? null : null) ?? data.staff?.branch?.name ?? null;

    const renderDay = (ymd: string) => {
        const day: ScheduleDayView = data.days?.get(ymd) ?? { date: ymd, kind: 'unconfigured', intervals: [], breaks: [], branchId: null };
        const temporary = day.kind === 'working' && day.branchId && homeBranchId && day.branchId !== homeBranchId;
        const branch = branchName(day.kind === 'working' ? day.branchId : null);
        const isToday = ymd === data.today;
        return (
            <View key={ymd} style={[styles.day, isToday ? styles.today : null]} testID={`schedule-day-${ymd}`}>
                <View style={styles.date}>
                    <Text style={[styles.weekday, isToday ? styles.weekdayToday : null]}>
                        {t(`staff.schedule.dow.${isoWeekdayOfYmd(ymd)}` as MobileI18nKey)}
                    </Text>
                    <Text style={styles.dayNumber}>{dmy(ymd).slice(0, 5)}</Text>
                </View>
                <View style={styles.body}>
                    {day.kind === 'working' ? (
                        <>
                            <Text style={styles.hours}>{rangeText(day.intervals)}</Text>
                            {day.breaks.length ? <Text style={styles.meta}>{t('staff.schedule.breaks', { ranges: rangeText(day.breaks) })}</Text> : null}
                            {branch ? (
                                <Text style={temporary ? styles.temporary : styles.meta}>
                                    {t(temporary ? 'staff.schedule.temporaryBranch' : 'staff.schedule.mainBranch', { name: branch })}
                                </Text>
                            ) : null}
                        </>
                    ) : day.kind === 'unconfigured' ? (
                        <Text style={styles.muted}>{t('staff.schedule.notConfigured')}</Text>
                    ) : (
                        <StatusPill
                            label={t(day.kind === 'off' ? 'staff.schedule.dayOff' : 'staff.schedule.absence')}
                            tone={day.kind === 'off' ? 'neutral' : 'warning'}
                        />
                    )}
                </View>
                {isToday ? <Badge label={t('staff.schedule.today')} tone="accent" /> : null}
            </View>
        );
    };

    return (
        <Screen refreshing={data.refreshing} onRefresh={data.onRefresh} testID="staff-schedule-screen">
            {data.weeks.map((week, index) => (
                <Section
                    key={week[0]}
                    title={t(index === 0 ? 'staff.schedule.currentWeek' : 'staff.schedule.nextWeek')}
                    caption={t('staff.schedule.weekRange', { from: dmy(week[0]), to: dmy(week[6]) })}
                >
                    <ListGroup>{week.map(renderDay)}</ListGroup>
                </Section>
            ))}
            <View style={styles.notes}>
                {(['staff.schedule.managedByOwner', 'staff.schedule.unconfiguredHint'] as const).map((key) => (
                    <View key={key} style={styles.note}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
                        <Text style={styles.noteText}>{t(key)}</Text>
                    </View>
                ))}
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    day: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
    },
    today: {
        marginHorizontal: -space.lg,
        paddingHorizontal: space.lg,
        backgroundColor: colors.tone.accent.bg,
    },
    date: { width: 52, gap: space.xxs },
    weekday: { ...typeScale.bodyStrong, color: colors.text.primary },
    weekdayToday: { color: colors.tone.accent.fg },
    dayNumber: { ...typeScale.caption, color: colors.text.tertiary },
    body: { flex: 1, minWidth: 0, gap: space.xxs, alignItems: 'flex-start' },
    hours: { ...typeScale.bodyStrong, color: colors.text.primary },
    meta: { ...typeScale.caption, color: colors.text.secondary },
    temporary: { ...typeScale.caption, color: colors.tone.accent.fg },
    muted: { ...typeScale.body, color: colors.text.tertiary },
    notes: { gap: space.sm, padding: space.md, borderRadius: radii.lg, backgroundColor: colors.surface.card },
    note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
    noteText: { ...typeScale.caption, color: colors.text.secondary, flex: 1 },
});
