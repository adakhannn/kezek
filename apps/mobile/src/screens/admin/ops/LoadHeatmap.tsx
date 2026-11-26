import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../constants/colors';
import { radii, space, typeScale } from '../../../constants/theme';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import { formatNumber } from '../../manage/opsKit/money';
import { heatLevel, type HeatmapMode, type HeatmapRow } from './adminOpsLogic';

/*
 * The website's occupancy heatmap (/admin/analytics/load) sized for a phone: a row per date or
 * weekday, 24 hour cells coloured in the website's five steps, hour marks every three hours and a
 * legend. A tap on a row lists its busy hours with the numbers the website shows on hover.
 */

const LABEL_WIDTH = 52;
const HOUR_MARKS = [0, 3, 6, 9, 12, 15, 18, 21];
/** The success hue at the five steps of the website's emerald scale. */
const LEVEL_FILL = [
    colors.fill.track,
    'rgba(52, 211, 153, 0.18)',
    'rgba(52, 211, 153, 0.34)',
    'rgba(52, 211, 153, 0.52)',
    'rgba(52, 211, 153, 0.74)',
    'rgba(52, 211, 153, 0.96)',
];

const WEEKDAY_KEY: Record<string, MobileI18nKey> = {
    '0': 'adminOps.weekday.0',
    '1': 'adminOps.weekday.1',
    '2': 'adminOps.weekday.2',
    '3': 'adminOps.weekday.3',
    '4': 'adminOps.weekday.4',
    '5': 'adminOps.weekday.5',
    '6': 'adminOps.weekday.6',
};

export default function LoadHeatmap({ rows, max, mode, testID }: { rows: HeatmapRow[]; max: number; mode: HeatmapMode; testID?: string }) {
    const { t } = useLanguage();
    const [selected, setSelected] = useState<string | null>(null);
    const rowLabel = (key: string) => (mode === 'byWeekday' ? t(WEEKDAY_KEY[key] ?? 'adminOps.weekday.0') : `${key.slice(8, 10)}.${key.slice(5, 7)}`);
    const fullLabel = (key: string) => (mode === 'byWeekday' ? rowLabel(key) : key);
    const selectedRow = rows.find((row) => row.key === selected) ?? null;

    return (
        <View style={styles.root} testID={testID}>
            <View style={styles.row} importantForAccessibility="no-hide-descendants">
                <Text style={[styles.axis, { width: LABEL_WIDTH }]}>{t('adminOps.analytics.load.hour')}</Text>
                <View style={styles.marks}>
                    {HOUR_MARKS.map((hour) => (
                        <Text key={hour} style={[styles.axis, styles.mark, { left: `${(hour / 24) * 100}%` }]}>{hour}</Text>
                    ))}
                </View>
            </View>
            {rows.map((row) => {
                const active = row.key === selected;
                const summary = row.peakHour === null
                    ? t('adminOps.analytics.load.rowEmpty', { label: fullLabel(row.key) })
                    : t('adminOps.analytics.load.rowSummary', {
                        label: fullLabel(row.key),
                        count: formatNumber(Math.round(row.total), t.locale),
                        hour: row.peakHour,
                    });
                return (
                    <Pressable
                        key={row.key}
                        onPress={() => setSelected(active ? null : row.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={summary}
                        style={({ pressed }) => [styles.row, styles.dataRow, active ? styles.activeRow : null, pressed ? styles.pressed : null]}
                        testID={testID ? `${testID}-row-${row.key}` : undefined}
                    >
                        <Text style={[styles.rowLabel, { width: LABEL_WIDTH }, active ? styles.rowLabelActive : null]} numberOfLines={1}>
                            {rowLabel(row.key)}
                        </Text>
                        <View style={styles.cells}>
                            {row.cells.map((value, hour) => (
                                <View key={hour} style={[styles.cell, { backgroundColor: LEVEL_FILL[heatLevel(value, max)] }]} />
                            ))}
                        </View>
                    </Pressable>
                );
            })}
            <View style={styles.legend} importantForAccessibility="no-hide-descendants">
                <Text style={styles.axis}>{t('adminOps.analytics.load.minLoad')}</Text>
                <View style={styles.swatches}>
                    {LEVEL_FILL.slice(1).map((fill) => <View key={fill} style={[styles.swatch, { backgroundColor: fill }]} />)}
                </View>
                <Text style={styles.axis}>{t('adminOps.analytics.load.maxLoad')}</Text>
            </View>
            {selectedRow ? (
                <View style={styles.detail} testID={testID ? `${testID}-detail` : undefined}>
                    {selectedRow.cells.map((value, hour) => (value > 0 ? (
                        <Text key={hour} style={styles.detailText}>
                            {t('adminOps.analytics.load.cellBookings', {
                                label: fullLabel(selectedRow.key),
                                hour,
                                count: formatNumber(Math.round(value), t.locale),
                            })}
                        </Text>
                    ) : null))}
                    {selectedRow.peakHour === null ? (
                        <Text style={styles.detailText}>{t('adminOps.analytics.load.rowEmpty', { label: fullLabel(selectedRow.key) })}</Text>
                    ) : null}
                </View>
            ) : (
                <Text style={styles.hint}>{t('adminOps.analytics.load.cellDetail')}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { gap: space.xxs },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    dataRow: { minHeight: 24, borderRadius: radii.xs, paddingVertical: 2 },
    activeRow: { backgroundColor: colors.fill.selected },
    pressed: { opacity: colors.interactive.pressedOpacity },
    marks: { flex: 1, height: 16 },
    mark: { position: 'absolute', top: 0 },
    axis: { ...typeScale.caption, color: colors.text.tertiary },
    rowLabel: { ...typeScale.caption, color: colors.text.secondary, fontVariant: ['tabular-nums'] },
    rowLabelActive: { color: colors.text.primary },
    cells: { flex: 1, flexDirection: 'row', gap: 2 },
    cell: { flex: 1, height: 16, borderRadius: 3 },
    legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
    swatches: { flexDirection: 'row', gap: 2 },
    swatch: { width: 16, height: 12, borderRadius: 3 },
    detail: { gap: space.xxs, marginTop: space.sm, padding: space.md, borderRadius: radii.md, backgroundColor: colors.fill.input },
    detailText: { ...typeScale.callout, color: colors.text.primary },
    hint: { ...typeScale.caption, color: colors.text.tertiary, marginTop: space.xs },
});
