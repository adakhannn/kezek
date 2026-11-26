import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import ActionBar from '../../components/ui/ActionBar';
import Screen from '../../components/ui/Screen';
import { SkeletonList } from '../../components/ui/Skeleton';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useLanguage } from '../../i18n';

/*
 * The frame of the six booking steps (docs/mobile/UI_GUIDE.md): the header says the step
 * ("2 / 6 · Услуга"), one thin progress bar sits under it, the content scrolls on the page, and
 * Back / Next live in the sticky bottom bar.
 */

type StepAction = {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    accessibilityHint?: string;
    testID?: string;
};

export function BookingStepScreen({
    step,
    children,
    next,
    back,
    summary,
    keyboard,
    testID,
}: {
    step: number;
    children: ReactNode;
    /** The primary action of the step (Next / Book); no bar without it. */
    next?: StepAction;
    /** Back to the previous step. */
    back?: () => void;
    /** A short line above the buttons (the total of the chosen services). */
    summary?: ReactNode;
    keyboard?: boolean;
    testID?: string;
}) {
    const { t } = useLanguage();
    return (
        <View style={styles.page} testID={testID}>
            <BookingProgressIndicator currentStep={step} />
            <Screen
                keyboard={keyboard}
                footer={next ? (
                    <ActionBar
                        primary={next}
                        secondary={back ? { title: t('booking.nav.back'), onPress: back } : undefined}
                    >
                        {summary}
                    </ActionBar>
                ) : undefined}
            >
                {children}
            </Screen>
        </View>
    );
}

/** The business the person books with: one muted context line, never a second title. */
export function BookingContextLine({ name, detail }: { name?: string | null; detail?: string | null }) {
    if (!name) return null;
    return (
        <View style={styles.context}>
            <Ionicons name="storefront-outline" size={16} color={colors.text.secondary} accessible={false} importantForAccessibility="no" />
            <Text style={styles.contextName} numberOfLines={1}>{name}</Text>
            {detail ? <Text style={styles.contextDetail} numberOfLines={1}>· {detail}</Text> : null}
        </View>
    );
}

/** A step that is still loading: the list it will show, as a skeleton. */
export function BookingStepSkeleton({ rows = 4, avatar = false, label }: { rows?: number; avatar?: boolean; label: string }) {
    return (
        <View accessibilityLabel={label}>
            <SkeletonList rows={rows} avatar={avatar} />
        </View>
    );
}

/**
 * One option of a step inside a ListGroup: a leading mark (radio, checkbox or an avatar), the
 * title and its details, and a value on the right (a price). Selected = accent title and mark.
 */
export function BookingOptionRow({
    title,
    subtitle,
    value,
    valueHint,
    leading,
    selected,
    multiple = false,
    onPress,
    accessibilityLabel,
    accessibilityHint,
    footer,
    testID,
}: {
    title: string;
    subtitle?: string | null;
    value?: string | null;
    valueHint?: string | null;
    leading?: ReactNode;
    selected: boolean;
    multiple?: boolean;
    onPress: () => void;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    /** An element under the text (a rating). */
    footer?: ReactNode;
    testID?: string;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={multiple ? { checked: selected } : { selected, checked: selected }}
            accessibilityLabel={accessibilityLabel ?? [title, subtitle, value].filter(Boolean).join(', ')}
            accessibilityHint={accessibilityHint}
            style={({ pressed }) => [styles.option, pressed ? styles.pressed : null]}
            testID={testID}
        >
            {leading}
            <View style={styles.optionBody}>
                <Text style={[styles.optionTitle, selected ? styles.optionTitleSelected : null]}>{title}</Text>
                {subtitle ? <Text style={styles.optionSubtitle}>{subtitle}</Text> : null}
                {footer}
            </View>
            {value || valueHint ? (
                <View style={styles.optionValueWrap}>
                    {value ? <Text style={styles.optionValue}>{value}</Text> : null}
                    {valueHint ? <Text style={styles.optionSubtitle}>{valueHint}</Text> : null}
                </View>
            ) : null}
            <SelectionMark selected={selected} multiple={multiple} />
        </Pressable>
    );
}

function SelectionMark({ selected, multiple }: { selected: boolean; multiple: boolean }) {
    if (multiple) {
        return (
            <View style={[styles.box, selected ? styles.markSelected : null]}>
                {selected ? <Ionicons name="checkmark" size={16} color={colors.text.light} /> : null}
            </View>
        );
    }
    return (
        <View style={[styles.radio, selected ? styles.radioSelected : null]}>
            {selected ? <View style={styles.radioDot} /> : null}
        </View>
    );
}

export const bookingStepStyles = StyleSheet.create({
    emptyActions: { width: '100%', gap: space.sm },
    banner: { marginBottom: 0 },
});

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.surface.page },
    context: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: -space.sm },
    contextName: { ...typeScale.callout, color: colors.text.secondary, flexShrink: 1 },
    contextDetail: { ...typeScale.callout, fontWeight: '400', color: colors.text.tertiary, flexShrink: 1 },
    option: {
        minHeight: Math.max(MIN_TOUCH_TARGET, 56),
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
    },
    pressed: { opacity: colors.interactive.pressedOpacity },
    optionBody: { flex: 1, minWidth: 0, gap: space.xxs, alignItems: 'flex-start' },
    optionTitle: { ...typeScale.bodyStrong, color: colors.text.primary },
    optionTitleSelected: { color: colors.tone.accent.fg },
    optionSubtitle: { ...typeScale.caption, color: colors.text.secondary },
    optionValueWrap: { alignItems: 'flex-end', gap: space.xxs, maxWidth: '40%' },
    optionValue: { ...typeScale.bodyStrong, color: colors.text.primary, textAlign: 'right' },
    box: {
        width: 24,
        height: 24,
        borderRadius: radii.xs,
        borderWidth: 2,
        borderColor: colors.border.strong,
        alignItems: 'center',
        justifyContent: 'center',
    },
    markSelected: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    radio: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.border.strong,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: { borderColor: colors.tone.accent.fg },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.tone.accent.fg },
});
