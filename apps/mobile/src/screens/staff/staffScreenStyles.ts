import { StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    content: {
        paddingBottom: 320,
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
    card: {
        margin: colors.layout.space5,
        marginBottom: 0,
    },
    section: {
        padding: colors.layout.space5,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 16,
    },
    branchName: {
        fontSize: 18,
        fontWeight: '500',
        color: colors.text.primary,
    },
    businessName: {
        fontSize: 18,
        fontWeight: '500',
        color: colors.text.primary,
    },
    bookingsList: {
        gap: 12,
    },
    bookingCard: {
        marginBottom: 12,
    },
    bookingService: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 8,
    },
    bookingClient: {
        fontSize: 14,
        color: colors.text.secondary,
        marginBottom: 4,
    },
    bookingPhone: {
        fontSize: 14,
        color: colors.accent.indigo,
        marginBottom: 8,
    },
    bookingTime: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
    },
    bookingDate: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text.primary,
        marginBottom: 4,
    },
    bookingTimeRange: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    secondaryAction: {
        marginTop: colors.layout.space3,
    },
    changeBusinessAction: {
        marginTop: colors.layout.space4,
    },
    pickerError: {
        marginBottom: colors.layout.space4,
    },
    pickerList: {
        gap: colors.layout.space3,
    },
    pickerOption: {
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space3,
        paddingHorizontal: colors.layout.space4,
        paddingVertical: colors.layout.space3,
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.surface.card,
    },
    pickerOptionCurrent: {
        borderColor: colors.accent.primary,
    },
    pickerOptionText: {
        flex: 1,
    },
    pickerBusiness: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
    },
    pickerBranch: {
        marginTop: 4,
        fontSize: 14,
        color: colors.text.secondary,
    },
    pickerCurrentMark: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text.secondary,
    },
});
