import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../constants/accessibility';
import { colors } from '../constants/colors';
import { layout, radii, space } from '../constants/theme';

type Tab<T extends string> = { key: T; label: string };

type Props<T extends string> = {
    tabs: readonly Tab<T>[];
    value: T;
    onChange: (value: T) => void;
    testID?: string;
    /**
     * Scroll sideways instead of sharing the width. Defaults to true for more than three tabs;
     * labels never wrap, so keep them to one or two short words.
     */
    scrollable?: boolean;
};

/** Two to four mutually exclusive views of one screen (upcoming / past, today / upcoming). */
export default function SegmentedTabs<T extends string>({ tabs, value, onChange, testID, scrollable }: Props<T>) {
    const scroll = scrollable ?? tabs.length > 3;
    const items = tabs.map((tab) => {
        const selected = tab.key === value;
        return (
            <Pressable
                key={tab.key}
                onPress={() => onChange(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={tab.label}
                style={[styles.tab, scroll ? styles.tabScroll : styles.tabFill, selected ? styles.tabSelected : null]}
                testID={testID ? `${testID}-${tab.key}` : undefined}
            >
                <Text
                    style={[styles.label, selected ? styles.labelSelected : null]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={!scroll}
                    minimumFontScale={0.8}
                >
                    {tab.label}
                </Text>
            </Pressable>
        );
    });

    if (scroll) {
        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.scrollBleed}
                contentContainerStyle={styles.scrollContent}
                accessibilityRole="tablist"
                testID={testID}
            >
                <View style={styles.wrap}>{items}</View>
            </ScrollView>
        );
    }
    return (
        <View style={[styles.wrap, styles.wrapSpaced]} accessibilityRole="tablist" testID={testID}>
            {items}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        padding: space.xs,
        gap: space.xs,
        borderRadius: radii.lg,
        backgroundColor: colors.surface.card,
    },
    wrapSpaced: { marginBottom: space.lg },
    scrollBleed: { flexGrow: 0, marginHorizontal: -layout.gutter, marginBottom: space.lg },
    scrollContent: { paddingHorizontal: layout.gutter },
    tab: {
        minHeight: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        paddingHorizontal: space.md,
    },
    tabFill: { flex: 1 },
    tabScroll: { paddingHorizontal: space.lg },
    tabSelected: {
        backgroundColor: colors.accent.primary,
        ...colors.shadow.sm,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text.secondary,
    },
    labelSelected: {
        color: colors.text.light,
    },
});
