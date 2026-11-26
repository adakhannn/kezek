import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { space, typeScale } from '../../constants/theme';

type SectionProps = {
    /** Short noun ("Записи", "Команда"). Optional: a section can be just spacing. */
    title?: string;
    /** One muted line under the title, only when it prevents a mistake. */
    caption?: string;
    /** A text action on the right ("Все", "Изменить"). */
    actionLabel?: string;
    onAction?: () => void;
    /** Any custom element on the right instead of the text action. */
    right?: ReactNode;
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Gap between children (default 12). */
    gap?: number;
    testID?: string;
};

/** A titled group of content with no box of its own: the page is the background. */
export default function Section({ title, caption, actionLabel, onAction, right, children, style, gap = space.md, testID }: SectionProps) {
    const hasHeader = Boolean(title || right || (actionLabel && onAction));
    return (
        <View style={[styles.section, style]} testID={testID}>
            {hasHeader ? (
                <View style={styles.header}>
                    <View style={styles.headerText}>
                        {title ? <Text style={styles.title} accessibilityRole="header">{title}</Text> : null}
                        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
                    </View>
                    {right ?? (actionLabel && onAction ? (
                        <Pressable
                            onPress={onAction}
                            accessibilityRole="button"
                            accessibilityLabel={actionLabel}
                            hitSlop={8}
                            style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
                        >
                            <Text style={styles.actionText}>{actionLabel}</Text>
                        </Pressable>
                    ) : null)}
                </View>
            ) : null}
            {children ? <View style={{ gap }}>{children}</View> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: space.md },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    headerText: { flex: 1, gap: space.xxs },
    title: { ...typeScale.headline, color: colors.text.primary },
    caption: { ...typeScale.caption, color: colors.text.secondary },
    action: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: space.xs },
    actionText: { ...typeScale.callout, fontWeight: '600', color: colors.tone.accent.fg },
    pressed: { opacity: colors.interactive.pressedOpacity },
});
