import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import ActionBar from '../../../components/ui/ActionBar';
import { StatusPill } from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { TimeField } from '../../../components/ui/DateTimeFields';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import { MIN_TOUCH_TARGET } from '../../../constants/accessibility';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale } from '../../../constants/theme';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import {
    isTime,
    isValidWeek,
    MAX_RANGES,
    padTime,
    padWeek,
    scheduleWeek,
    withIntervals,
} from './branchSchedule';
import { catalogApi, catalogKeys, type BranchScheduleRow, type TimeRange } from './catalogApi';
import { catalogErrorText } from './catalogErrors';
import { QueryState } from './catalogUi';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageBranchSchedule'>;

/** The website's BranchScheduleEditor (/dashboard/branches/[id]): opening hours and breaks per weekday. */
export default function BranchScheduleScreen({ route }: Props) {
    const { bizId, branchId } = route.params;
    const query = useQuery({
        queryKey: catalogKeys.branch(bizId, branchId),
        queryFn: () => catalogApi.branch(bizId, branchId),
    });
    return (
        <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} skeleton="form">
            {() => <ScheduleEditor bizId={bizId} branchId={branchId} initial={scheduleWeek(query.data!.schedule)} />}
        </QueryState>
    );
}

function ScheduleEditor({ bizId, branchId, initial }: { bizId: string; branchId: string; initial: BranchScheduleRow[] }) {
    const { t } = useLanguage();
    const queryClient = useQueryClient();
    const [days, setDays] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const change = (index: number, day: BranchScheduleRow) => {
        setDays((current) => current.map((item, i) => (i === index ? day : item)));
        setError('');
        setSuccess(false);
    };

    const save = async () => {
        setError('');
        setSuccess(false);
        const week = padWeek(days);
        setDays(week);
        if (!isValidWeek(week)) {
            setError(t('catalog.scheduling.invalid'));
            return;
        }
        setSaving(true);
        try {
            await catalogApi.saveSchedule(bizId, branchId, week);
            await queryClient.invalidateQueries({ queryKey: catalogKeys.branch(bizId, branchId) });
            setSuccess(true);
        } catch (cause) {
            setError(catalogErrorText(cause, t('catalog.branches.schedule.error.server'), t));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Screen
            keyboard
            gap={space.md}
            testID="manage-branch-schedule-screen"
            footer={(
                <ActionBar
                    primary={{
                        title: t('catalog.branches.schedule.saveButton'),
                        onPress: () => void save(),
                        loading: saving,
                        testID: 'branch-schedule-save',
                    }}
                />
            )}
        >
            {/* The header says "Расписание работы филиала": one line on what saving does. */}
            <ScreenIntro>{t('catalog.scheduling.branchHint')}</ScreenIntro>
            {error ? <FeedbackBanner variant="danger" message={error} compact /> : null}
            {success ? <FeedbackBanner variant="success" message={t('catalog.branches.schedule.success')} compact /> : null}
            {days.map((day, index) => {
                const label = t(`catalog.app.weekday.${day.day_of_week}` as MobileI18nKey);
                const closed = day.intervals.length === 0;
                return (
                    <Card key={day.day_of_week} variant="plain" padding="md" style={styles.day} accessibilityLabel={label}>
                        <View style={styles.dayHeader}>
                            <Text style={styles.dayName} accessibilityRole="header">{label}</Text>
                            {closed ? <StatusPill label={t('catalog.scheduling.closed')} tone="neutral" /> : null}
                        </View>
                        <RangesEditor
                            label={t('catalog.scheduling.work')}
                            ranges={day.intervals}
                            disabled={saving}
                            onChange={(intervals) => change(index, withIntervals(day, intervals))}
                            testID={`schedule-${day.day_of_week}-work`}
                        />
                        {!closed ? (
                            <RangesEditor
                                label={t('catalog.scheduling.breaks')}
                                ranges={day.breaks}
                                disabled={saving}
                                onChange={(breaks) => change(index, { ...day, breaks })}
                                testID={`schedule-${day.day_of_week}-breaks`}
                            />
                        ) : null}
                    </Card>
                );
            })}
        </Screen>
    );
}

/** The website's TimeRangesEditor: start – end pairs, remove, add up to 8. */
function RangesEditor({ label, ranges, onChange, disabled, testID }: {
    label: string;
    ranges: TimeRange[];
    onChange: (ranges: TimeRange[]) => void;
    disabled: boolean;
    testID: string;
}) {
    const { t } = useLanguage();
    const set = (index: number, part: 'start' | 'end', value: string) =>
        onChange(ranges.map((range, i) => (i === index ? { ...range, [part]: value } : range)));
    return (
        <View style={styles.ranges} testID={testID}>
            <Text style={styles.rangesLabel}>{label}</Text>
            {ranges.map((range, index) => {
                const invalid = (['start', 'end'] as const).some((part) => range[part] && !isTime(padTime(range[part])));
                return (
                    <View key={index}>
                        <View style={styles.rangeRow}>
                            {(['start', 'end'] as const).map((part) => {
                                const partLabel = t(part === 'start' ? 'catalog.scheduling.start' : 'catalog.scheduling.end');
                                const value = range[part];
                                return (
                                    <View key={part} style={styles.rangeCell}>
                                        {part === 'end' ? <Text style={styles.dash}>–</Text> : null}
                                        <TimeField
                                            label={`${label}: ${partLabel} ${index + 1}`}
                                            value={isTime(padTime(value)) ? padTime(value) : ''}
                                            onChange={(next) => set(index, part, next)}
                                            minuteInterval={5}
                                            disabled={disabled}
                                            compact
                                            style={styles.time}
                                            testID={`${testID}-${index}-${part}`}
                                        />
                                    </View>
                                );
                            })}
                            <Pressable
                                onPress={() => onChange(ranges.filter((_, i) => i !== index))}
                                disabled={disabled}
                                accessibilityRole="button"
                                accessibilityLabel={`${label}: ${t('catalog.scheduling.remove')} ${index + 1}`}
                                style={({ pressed }) => [styles.remove, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
                            >
                                <Ionicons name="close" size={20} color={colors.tone.danger.fg} />
                            </Pressable>
                        </View>
                        {invalid ? <Text style={styles.error} accessibilityRole="alert">{t('catalog.app.timeInvalid')}</Text> : null}
                    </View>
                );
            })}
            {ranges.length < MAX_RANGES ? (
                <Button
                    title={t('catalog.scheduling.add')}
                    onPress={() => onChange([...ranges, { start: '', end: '' }])}
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    leadingIcon={<Ionicons name="add" size={16} color={colors.tone.accent.fg} />}
                    textStyle={styles.addText}
                    style={styles.add}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    day: { gap: space.md },
    dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    dayName: { ...typeScale.headline, color: colors.text.primary },
    ranges: { gap: space.sm },
    rangesLabel: { ...typeScale.overline, color: colors.text.tertiary },
    rangeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    rangeCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
    dash: { ...typeScale.body, color: colors.text.secondary },
    time: { flex: 1 },
    remove: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.tone.danger.bg,
    },
    pressed: { opacity: colors.interactive.pressedOpacity },
    disabled: { opacity: colors.interactive.disabledOpacity },
    error: { ...typeScale.caption, color: colors.tone.danger.fg, marginTop: space.xs },
    add: { alignSelf: 'flex-start', paddingHorizontal: space.sm },
    addText: { color: colors.tone.accent.fg },
});
