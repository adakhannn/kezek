import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import Input from '../../../components/ui/Input';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import {
    formatTimeInput,
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
import { QueryState, ui } from './catalogUi';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageBranchSchedule'>;

/** The website's BranchScheduleEditor (/dashboard/branches/[id]): opening hours and breaks per weekday. */
export default function BranchScheduleScreen({ route }: Props) {
    const { bizId, branchId } = route.params;
    const query = useQuery({
        queryKey: catalogKeys.branch(bizId, branchId),
        queryFn: () => catalogApi.branch(bizId, branchId),
    });
    return (
        <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
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
        <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" testID="manage-branch-schedule-screen">
                <View style={ui.header}>
                    <Text style={ui.title} accessibilityRole="header">{t('catalog.branches.schedule.title')}</Text>
                    <Text style={ui.subtitle}>{t('catalog.scheduling.branchHint')}</Text>
                </View>
                {days.map((day, index) => {
                    const label = t(`catalog.app.weekday.${day.day_of_week}` as MobileI18nKey);
                    return (
                        <Card key={day.day_of_week} padding="md" accessibilityLabel={label}>
                            <Text style={ui.sectionTitle} accessibilityRole="header">
                                {label}{day.intervals.length === 0 ? ` — ${t('catalog.scheduling.closed')}` : ''}
                            </Text>
                            <RangesEditor
                                label={t('catalog.scheduling.work')}
                                ranges={day.intervals}
                                disabled={saving}
                                onChange={(intervals) => change(index, withIntervals(day, intervals))}
                                testID={`schedule-${day.day_of_week}-work`}
                            />
                            {day.intervals.length > 0 ? (
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
                {error ? <FeedbackBanner variant="danger" message={error} /> : null}
                {success ? <FeedbackBanner variant="success" message={t('catalog.branches.schedule.success')} /> : null}
                <Button title={t('catalog.branches.schedule.saveButton')} onPress={() => void save()} loading={saving} fullWidth />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

/** The website's TimeRangesEditor: start/end pairs, remove, add up to 8. */
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
        <View style={{ marginTop: 12 }} testID={testID}>
            <Text style={ui.muted}>{label}</Text>
            {ranges.map((range, index) => (
                <View key={index} style={[ui.row, { marginTop: 8, alignItems: 'flex-start' }]}>
                    {(['start', 'end'] as const).map((part) => {
                        const partLabel = t(part === 'start' ? 'catalog.scheduling.start' : 'catalog.scheduling.end');
                        const value = range[part];
                        return (
                            <Input
                                key={part}
                                label={partLabel}
                                value={value}
                                onChangeText={(text) => set(index, part, formatTimeInput(text))}
                                onBlur={() => set(index, part, padTime(value))}
                                placeholder={t('catalog.app.timePlaceholder')}
                                keyboardType="numbers-and-punctuation"
                                maxLength={5}
                                editable={!disabled}
                                error={value && !isTime(padTime(value)) ? t('catalog.app.timeInvalid') : undefined}
                                accessibilityLabel={`${label}: ${partLabel} ${index + 1}`}
                                containerStyle={{ flex: 1, width: undefined, marginBottom: 0 }}
                                testID={`${testID}-${index}-${part}`}
                            />
                        );
                    })}
                    <Pressable
                        onPress={() => onChange(ranges.filter((_, i) => i !== index))}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityLabel={`${label}: ${t('catalog.scheduling.remove')} ${index + 1}`}
                        style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', marginTop: 22 }}
                    >
                        <Text style={ui.error}>{t('catalog.scheduling.remove')}</Text>
                    </Pressable>
                </View>
            ))}
            {ranges.length < MAX_RANGES ? (
                <Button
                    title={t('catalog.scheduling.add')}
                    onPress={() => onChange([...ranges, { start: '', end: '' }])}
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    style={{ alignSelf: 'flex-start', marginTop: 8 }}
                />
            ) : null}
        </View>
    );
}
