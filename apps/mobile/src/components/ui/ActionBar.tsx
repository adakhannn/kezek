import { useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { colors } from '../../constants/colors';
import { layout, space } from '../../constants/theme';
import Button from './Button';

type Action = {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    testID?: string;
    accessibilityHint?: string;
};

/**
 * The sticky bottom bar of a form or a flow step: one primary action (and an optional secondary
 * one to its left). Pass it as `footer` of Screen so the content scrolls above it.
 */
export default function ActionBar({ primary, secondary, children, testID }: {
    primary: Action;
    secondary?: Action;
    /** Extra line above the buttons (a total, a short warning). */
    children?: ReactNode;
    testID?: string;
}) {
    const insets = useContext(SafeAreaInsetsContext);
    return (
        <View style={[styles.bar, { paddingBottom: space.md + (insets?.bottom ?? 0) }]} testID={testID}>
            {children}
            <View style={styles.buttons}>
                {secondary ? (
                    <Button
                        title={secondary.title}
                        onPress={secondary.onPress}
                        variant="outline"
                        size="lg"
                        loading={secondary.loading}
                        disabled={secondary.disabled}
                        accessibilityHint={secondary.accessibilityHint}
                        testID={secondary.testID}
                        style={styles.secondary}
                    />
                ) : null}
                <View style={styles.primary}>
                    <Button
                        title={primary.title}
                        onPress={primary.onPress}
                        size="lg"
                        loading={primary.loading}
                        disabled={primary.disabled}
                        accessibilityHint={primary.accessibilityHint}
                        testID={primary.testID}
                        fullWidth
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        paddingHorizontal: layout.gutter,
        paddingTop: space.md,
        gap: space.sm,
        backgroundColor: colors.surface.page,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    buttons: { flexDirection: 'row', gap: space.md },
    secondary: { flex: 1 },
    primary: { flex: 2 },
});
