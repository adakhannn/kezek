import { Ionicons } from '@expo/vector-icons';

import { colors } from '../constants/colors';

export const mainTabScreenOptions = {
    tabBarActiveTintColor: colors.primary.from,
    tabBarInactiveTintColor: colors.text.tertiary,
    tabBarStyle: {
        backgroundColor: colors.background.secondary,
        borderTopWidth: 1,
        borderTopColor: colors.border.dark,
    },
    headerStyle: {
        backgroundColor: colors.background.secondary,
    },
    headerShadowVisible: false,
    headerTintColor: colors.text.primary,
    headerTitleStyle: {
        fontWeight: '600' as const,
        fontSize: 18,
        color: colors.text.primary,
    },
};

export const cabinetStackScreenOptions = {
    headerStyle: {
        backgroundColor: colors.background.secondary,
    },
    headerShadowVisible: false,
    headerTintColor: colors.text.primary,
    headerTitleStyle: {
        fontWeight: '600' as const,
        fontSize: 18,
        color: colors.text.primary,
    },
};

export function renderTabIcon(name: React.ComponentProps<typeof Ionicons>['name']) {
    return ({ color, size }: { color: string; size: number }) => (
        <Ionicons name={name} size={size} color={color} />
    );
}
