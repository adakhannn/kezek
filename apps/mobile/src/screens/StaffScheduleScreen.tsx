import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { colors } from '../constants/colors';
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
        return <LoadingSpinner message={t('common.loading')} />;
    }

    if (data.needsSelection) {
        return (
            <EmptyState
                icon="briefcase"
                title={t('staff.chooseBusinessOnTab', { tab: t('nav.staffTab') })}
                action={
                    <Button
                        title={t('staff.openTab', { tab: t('nav.staffTab') })}
                        onPress={() => navigation.navigate('Main', { screen: 'Staff' })}
                        fullWidth
                    />
                }
            />
        );
    }

    if (!data.staff) {
        return <EmptyState icon="briefcase" title={t('staff.notStaff')} message={t('staff.workspace.notStaffMessage')} />;
    }

    if (data.error && !data.days) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('staff.schedule.loadError')}
                message={t('staff.checkConnection')}
                action={<Button title={t('staff.retry')} onPress={() => void data.onRefresh()} variant="outline" fullWidth />}
            />
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
            <Card key={ymd} style={[styles.day, isToday ? styles.today : null]} testID={`schedule-day-${ymd}`}>
                <View style={styles.dayHeader}>
                    <Text style={styles.dayName}>
                        {t(`staff.schedule.dow.${isoWeekdayOfYmd(ymd)}` as MobileI18nKey)} · {dmy(ymd).slice(0, 5)}
                    </Text>
                    {isToday ? <Text style={styles.todayMark}>{t('staff.schedule.today')}</Text> : null}
                </View>
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
                ) : (
                    <Text style={day.kind === 'unconfigured' ? styles.muted : styles.off}>
                        {t(day.kind === 'off' ? 'staff.schedule.dayOff' : day.kind === 'absence' ? 'staff.schedule.absence' : 'staff.schedule.notConfigured')}
                    </Text>
                )}
            </Card>
        );
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="staff-schedule-screen"
            refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={() => void data.onRefresh()} />}
        >
            {data.weeks.map((week, index) => (
                <View key={week[0]} style={styles.week}>
                    <Text style={styles.weekTitle}>{t(index === 0 ? 'staff.schedule.currentWeek' : 'staff.schedule.nextWeek')}</Text>
                    <Text style={styles.weekRange}>{t('staff.schedule.weekRange', { from: dmy(week[0]), to: dmy(week[6]) })}</Text>
                    {week.map(renderDay)}
                </View>
            ))}
            <Text style={styles.footnote}>• {t('staff.schedule.managedByOwner')}</Text>
            <Text style={styles.footnote}>• {t('staff.schedule.unconfiguredHint')}</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    content: {
        padding: colors.layout.space5,
        paddingBottom: 160,
    },
    week: {
        marginBottom: colors.layout.space6,
        gap: colors.layout.space2,
    },
    weekTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
    },
    weekRange: {
        fontSize: 14,
        color: colors.text.secondary,
        marginBottom: colors.layout.space2,
    },
    day: {
        gap: 4,
    },
    today: {
        borderWidth: 1,
        borderColor: colors.accent.primary,
    },
    dayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
    },
    todayMark: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.accent.indigo,
    },
    hours: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text.primary,
    },
    meta: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    temporary: {
        fontSize: 14,
        color: colors.accent.indigo,
    },
    off: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.status.danger,
    },
    muted: {
        fontSize: 15,
        color: colors.text.tertiary,
    },
    footnote: {
        fontSize: 13,
        color: colors.text.tertiary,
        marginTop: colors.layout.space1,
    },
});
