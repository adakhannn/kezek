import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { MIN_TOUCH_TARGET } from '../../../constants/accessibility';
import { colors } from '../../../constants/colors';
import { useLanguage } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';

/** A checkbox line (the website's <input type="checkbox"> with its label). */
export function CheckRow({ label, hint, checked, onChange, disabled, testID }: {
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    testID?: string;
}) {
    return (
        <Pressable
            onPress={() => onChange(!checked)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityLabel={label}
            accessibilityHint={hint}
            accessibilityState={{ checked, disabled: !!disabled }}
            style={({ pressed }) => [ui.checkRow, pressed ? ui.pressed : null, disabled ? ui.disabled : null]}
            testID={testID}
        >
            <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={24}
                color={checked ? colors.accent.indigo : colors.text.secondary}
            />
            <View style={ui.checkText}>
                <Text style={ui.checkLabel}>{label}</Text>
                {hint ? <Text style={ui.checkHint}>{hint}</Text> : null}
            </View>
        </Pressable>
    );
}

/** A selectable chip (branch filter, promotion type). */
export function Chip({ label, selected, onPress, testID }: {
    label: string;
    selected: boolean;
    onPress: () => void;
    testID?: string;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [ui.chip, selected ? ui.chipSelected : null, pressed ? ui.pressed : null]}
            testID={testID}
        >
            <Text style={[ui.chipText, selected ? ui.chipTextSelected : null]}>{label}</Text>
        </Pressable>
    );
}

export function StatusPill({ active, label }: { active: boolean; label: string }) {
    return (
        <View style={[ui.pill, active ? ui.pillActive : null]}>
            <Text style={[ui.pillText, active ? ui.pillTextActive : null]}>{label}</Text>
        </View>
    );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <View style={ui.sectionHeader}>
            <Text style={ui.sectionTitle} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text style={ui.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
    );
}

/** Loading, then a failed read with a retry (FE-08: an error, never an empty form). */
export function QueryState({ isLoading, error, onRetry, children }: {
    isLoading: boolean;
    error: unknown;
    onRetry: () => void;
    children: () => ReactNode;
}) {
    const { t } = useLanguage();
    if (isLoading) return <LoadingSpinner message={t('common.loading')} />;
    if (error) {
        return (
            <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
                <EmptyState
                    icon="alert-circle"
                    title={t('catalog.app.loadError')}
                    message={getErrorMessage(error, t('staff.checkConnection'), t)}
                    action={<Button title={t('catalog.app.retry')} onPress={onRetry} variant="outline" fullWidth />}
                />
            </ScrollView>
        );
    }
    return <>{children()}</>;
}

export const ui = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background.primary },
    content: { padding: colors.layout.space5, paddingBottom: 120, gap: colors.layout.space4 },
    header: { gap: 4 },
    title: { fontSize: 26, fontWeight: '700', color: colors.text.primary },
    subtitle: { fontSize: 15, color: colors.text.secondary },
    caption: { fontSize: 13, color: colors.text.tertiary },
    body: { fontSize: 15, color: colors.text.primary, lineHeight: 22 },
    muted: { fontSize: 14, color: colors.text.secondary, lineHeight: 20 },
    error: { fontSize: 13, color: colors.status.danger },
    row: { flexDirection: 'row', alignItems: 'center', gap: colors.layout.space2 },
    rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: colors.layout.space3 },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: colors.layout.space2 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: colors.layout.space2, marginTop: colors.layout.space3 },
    action: { flexGrow: 1, minHeight: MIN_TOUCH_TARGET },
    cardTitle: { fontSize: 17, fontWeight: '600', color: colors.text.primary, flexShrink: 1 },
    meta: { fontSize: 14, color: colors.text.secondary, marginTop: 4 },
    sectionHeader: { gap: 4, marginBottom: colors.layout.space3 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary },
    sectionSubtitle: { fontSize: 14, color: colors.text.secondary, lineHeight: 20 },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space3,
        minHeight: MIN_TOUCH_TARGET,
        paddingVertical: colors.layout.space2,
    },
    checkText: { flex: 1, gap: 2 },
    checkLabel: { fontSize: 15, color: colors.text.primary },
    checkHint: { fontSize: 13, color: colors.text.secondary },
    chip: {
        minHeight: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: colors.layout.space4,
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.surface.card,
    },
    chipSelected: { borderColor: colors.accent.primary, backgroundColor: colors.surface.emphasis },
    chipText: { fontSize: 14, color: colors.text.secondary },
    chipTextSelected: { color: colors.text.primary, fontWeight: '600' },
    pill: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: colors.surface.elevated,
    },
    pillActive: { backgroundColor: colors.feedback.successSurface },
    pillText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
    pillTextActive: { color: colors.status.success },
    pressed: { opacity: colors.interactive.pressedOpacity },
    disabled: { opacity: colors.interactive.disabledOpacity },
    divider: { height: 1, backgroundColor: colors.border.subtle, marginVertical: colors.layout.space3 },
});
