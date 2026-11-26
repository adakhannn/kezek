import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../constants/accessibility';
import { colors } from '../constants/colors';

type Tab<T extends string> = { key: T; label: string };

type Props<T extends string> = {
    tabs: readonly Tab<T>[];
    value: T;
    onChange: (value: T) => void;
    testID?: string;
};

/** Two or three mutually exclusive list views (upcoming / past, today / upcoming). */
export default function SegmentedTabs<T extends string>({ tabs, value, onChange, testID }: Props<T>) {
    return (
        <View style={styles.wrap} accessibilityRole="tablist" testID={testID}>
            {tabs.map((tab) => {
                const selected = tab.key === value;
                return (
                    <Pressable
                        key={tab.key}
                        onPress={() => onChange(tab.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        style={[styles.tab, selected ? styles.tabSelected : null]}
                    >
                        <Text style={[styles.label, selected ? styles.labelSelected : null]}>{tab.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        padding: colors.layout.space1,
        gap: colors.layout.space1,
        borderRadius: colors.layout.radiusLg,
        backgroundColor: colors.surface.elevated,
        marginBottom: colors.layout.space4,
    },
    tab: {
        flex: 1,
        minHeight: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: colors.layout.radiusMd,
        paddingHorizontal: colors.layout.space2,
    },
    tabSelected: {
        backgroundColor: colors.surface.card,
        borderWidth: 1,
        borderColor: colors.accent.primary,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text.secondary,
    },
    labelSelected: {
        color: colors.text.primary,
    },
});
