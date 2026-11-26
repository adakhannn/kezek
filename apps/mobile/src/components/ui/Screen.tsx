import { useContext, type ReactNode } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { colors } from '../../constants/colors';
import { layout, space } from '../../constants/theme';

type ScreenProps = {
    children: ReactNode;
    /** Pull to refresh: both are needed. */
    refreshing?: boolean;
    onRefresh?: () => void | Promise<void>;
    /** The screen is a tab of the floating tab bar: leave room for it at the bottom. */
    tabBar?: boolean;
    /** A sticky footer (ActionBar) under the scroll area; the content gets room for it. */
    footer?: ReactNode;
    /** Lift the content over the keyboard (forms). */
    keyboard?: boolean;
    /** Vertical gap between the direct children (default: the section gap, 24). */
    gap?: number;
    /** Render without a ScrollView (a screen that owns a FlatList). */
    scroll?: boolean;
    contentStyle?: StyleProp<ViewStyle>;
    testID?: string;
};

/**
 * The page of a screen: page background, the 16dp gutter, the vertical rhythm, pull to refresh
 * and the safe bottom space (home indicator, tab bar, sticky footer). The navigation header
 * carries the title: a screen starts with its content (or a ScreenIntro), never a second title.
 */
export default function Screen({
    children,
    refreshing,
    onRefresh,
    tabBar = false,
    footer,
    keyboard = false,
    gap = layout.sectionGap,
    scroll = true,
    contentStyle,
    testID,
}: ScreenProps) {
    // The navigators provide the insets; outside them (tests, previews) there is no inset.
    const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
    const bottom = tabBar
        ? layout.tabBarClearance + insets.bottom
        : footer
            ? space.xxl
            : space.xxxl + insets.bottom;
    const content = [styles.content, { gap, paddingBottom: bottom }, contentStyle];

    const body = scroll ? (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={keyboard ? 'on-drag' : undefined}
            automaticallyAdjustKeyboardInsets={keyboard}
            testID={testID}
            refreshControl={onRefresh ? (
                <RefreshControl
                    refreshing={!!refreshing}
                    onRefresh={() => void onRefresh()}
                    tintColor={colors.accent.indigo}
                    colors={[colors.accent.indigo]}
                    progressBackgroundColor={colors.surface.card}
                />
            ) : undefined}
        >
            {children}
        </ScrollView>
    ) : (
        <View style={[styles.scroll, content]} testID={testID}>{children}</View>
    );

    const page = (
        <View style={styles.page}>
            {body}
            {footer}
        </View>
    );

    if (!keyboard) return page;
    return (
        <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {page}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.surface.page },
    scroll: { flex: 1 },
    content: {
        paddingHorizontal: layout.gutter,
        paddingTop: space.lg,
    },
});
