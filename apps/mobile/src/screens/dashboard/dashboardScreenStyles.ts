import { StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        padding: colors.layout.space5,
        backgroundColor: colors.surface.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    businessList: {
        padding: colors.layout.space5,
        gap: 12,
    },
    businessPressable: {
        marginBottom: 12,
    },
    businessCard: {
        marginBottom: 0,
    },
    businessName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: 8,
    },
    businessAddress: {
        fontSize: 14,
        color: colors.text.secondary,
        marginBottom: 4,
    },
    businessPhone: {
        fontSize: 14,
        color: colors.accent.indigo,
        marginBottom: 12,
    },
    businessActions: {
        marginTop: 8,
    },
});
