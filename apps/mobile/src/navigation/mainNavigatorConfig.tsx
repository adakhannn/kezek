import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const TAB_BAR_HEIGHT = Platform.select({
    ios: 84,
    default: 74,
});

type HeaderTitleProps = {
    title: string;
    eyebrow?: string;
};

function NavigationHeaderTitle({ title, eyebrow }: HeaderTitleProps) {
    return (
        <View style={styles.headerTitleWrap}>
            {eyebrow ? <Text style={styles.headerEyebrow}>{eyebrow}</Text> : null}
            <Text numberOfLines={1} style={styles.headerTitle}>
                {title}
            </Text>
        </View>
    );
}

function buildBaseHeaderOptions(backgroundColor: string): NativeStackNavigationOptions {
    return {
        headerStyle: {
            backgroundColor,
        },
        headerShadowVisible: false,
        headerTintColor: colors.text.primary,
        headerTitleAlign: 'left',
        headerBackButtonDisplayMode: 'minimal',
        headerTitleStyle: {
            ...typography.sectionTitle,
            color: colors.text.primary,
        },
        contentStyle: {
            backgroundColor: colors.surface.page,
        },
    };
}

export const mainTabScreenOptions: BottomTabNavigationOptions = {
    tabBarActiveTintColor: colors.accent.primary,
    tabBarInactiveTintColor: colors.text.tertiary,
    tabBarHideOnKeyboard: true,
    sceneStyle: {
        backgroundColor: colors.surface.page,
    },
    tabBarStyle: {
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: 12,
        height: TAB_BAR_HEIGHT,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        paddingHorizontal: 8,
        borderTopWidth: 0,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.card,
        borderRadius: 26,
        ...colors.shadow.lg,
    },
    tabBarItemStyle: {
        borderRadius: 20,
        paddingVertical: 2,
    },
    tabBarLabelStyle: {
        ...typography.label,
        fontSize: 11,
        lineHeight: 14,
        marginTop: 1,
    },
    headerStyle: {
        backgroundColor: colors.surface.page,
    },
    headerShadowVisible: false,
    headerTintColor: colors.text.primary,
    headerTitleAlign: 'left',
    headerTitleStyle: {
        ...typography.sectionTitle,
        color: colors.text.primary,
    },
};

export const cabinetStackScreenOptions: NativeStackNavigationOptions = buildBaseHeaderOptions(colors.surface.page);
export const detailStackScreenOptions: NativeStackNavigationOptions = buildBaseHeaderOptions(colors.surface.page);
export const flowStackScreenOptions: NativeStackNavigationOptions = buildBaseHeaderOptions(colors.surface.card);

export function createNavigationHeaderTitle(title: string, eyebrow?: string) {
    return () => <NavigationHeaderTitle title={title} eyebrow={eyebrow} />;
}

export function createFlowScreenOptions(
    title: string,
    eyebrow?: string,
    extras?: Partial<NativeStackNavigationOptions>,
): NativeStackNavigationOptions {
    return {
        ...flowStackScreenOptions,
        headerTitle: createNavigationHeaderTitle(title, eyebrow),
        ...extras,
    };
}

export function renderTabIcon(name: React.ComponentProps<typeof Ionicons>['name']) {
    return ({ color, focused }: { color: string; size: number; focused: boolean }) => (
        <View
            style={[styles.tabIconWrap, focused ? styles.tabIconWrapActive : null]}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
        >
            <Ionicons
                name={name}
                size={focused ? 20 : 19}
                color={focused ? colors.text.light : color}
                accessible={false}
                importantForAccessibility="no"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    headerTitleWrap: {
        gap: 2,
    },
    headerEyebrow: {
        ...typography.label,
        fontSize: 11,
        lineHeight: 13,
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    headerTitle: {
        ...typography.sectionTitle,
        color: colors.text.primary,
    },
    tabIconWrap: {
        minWidth: 36,
        minHeight: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabIconWrapActive: {
        backgroundColor: colors.accent.primary,
        ...colors.shadow.sm,
    },
});
