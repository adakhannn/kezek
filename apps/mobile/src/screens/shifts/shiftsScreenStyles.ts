import { StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface.page,
    },
    header: {
        padding: 20,
        backgroundColor: colors.surface.canvas,
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
    filters: {
        padding: 16,
        backgroundColor: colors.surface.canvas,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    periodButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    periodButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: colors.surface.elevated,
        borderWidth: 1,
        borderColor: colors.border.light,
    },
    periodButtonActive: {
        backgroundColor: colors.accent.primary,
        borderColor: colors.accent.primary,
    },
    periodButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text.primary,
    },
    periodButtonTextActive: {
        color: colors.text.light,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        padding: 16,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text.secondary,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    statValueEmployee: {
        color: colors.status.success,
    },
    statValueBusiness: {
        color: colors.accent.indigo,
    },
    statPercent: {
        fontSize: 12,
        color: colors.text.secondary,
        marginTop: 4,
    },
    additionalStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 12,
    },
    additionalStatCard: {
        flex: 1,
        minWidth: '45%',
        padding: 12,
    },
    additionalStatLabel: {
        fontSize: 12,
        color: colors.text.secondary,
        marginBottom: 4,
    },
    additionalStatValue: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
    },
    shiftsSection: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 16,
    },
    emptySection: {
        padding: 16,
    },
    shiftCard: {
        marginBottom: 12,
        padding: 16,
    },
    shiftHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    shiftHeaderLeft: {
        flex: 1,
    },
    shiftHeaderTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    shiftDate: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
    },
    shiftStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    shiftStatusOpen: {
        backgroundColor: colors.feedback.successSurface,
    },
    shiftStatusClosed: {
        backgroundColor: colors.surface.elevated,
    },
    shiftStatusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    shiftStatusTextOpen: {
        color: colors.status.success,
    },
    shiftStatusTextClosed: {
        color: colors.text.secondary,
    },
    shiftClientsCount: {
        fontSize: 12,
        color: colors.text.secondary,
    },
    shiftTime: {
        fontSize: 12,
        color: colors.text.secondary,
        marginTop: 4,
    },
    shiftHeaderRight: {
        alignItems: 'flex-end',
        minWidth: 140,
    },
    shiftTotalAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: 4,
    },
    shiftConsumables: {
        fontSize: 10,
        color: colors.text.secondary,
        marginBottom: 4,
    },
    shiftFinancials: {
        marginTop: 4,
    },
    shiftMasterShare: {
        fontSize: 10,
        color: colors.text.primary,
        marginBottom: 2,
    },
    shiftMasterShareGuaranteed: {
        fontSize: 10,
        color: colors.status.success,
        fontWeight: '600',
        marginBottom: 2,
    },
    shiftBaseShareStriked: {
        fontSize: 10,
        color: colors.text.secondary,
        textDecorationLine: 'line-through',
        marginBottom: 2,
    },
    shiftGuaranteed: {
        fontSize: 10,
        color: colors.text.secondary,
        marginBottom: 2,
    },
    shiftHours: {
        fontSize: 10,
        color: colors.status.warning,
        marginBottom: 2,
    },
    shiftSalonShare: {
        fontSize: 10,
        color: colors.text.primary,
    },
    shiftItems: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
    },
    shiftItemsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 12,
    },
    shiftItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: colors.surface.elevated,
        borderRadius: 8,
        marginBottom: 8,
    },
    shiftItemLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bookingIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.status.success,
    },
    shiftItemInfo: {
        flex: 1,
    },
    shiftItemClient: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 4,
    },
    shiftItemService: {
        fontSize: 12,
        color: colors.text.secondary,
    },
    shiftItemRight: {
        alignItems: 'flex-end',
        minWidth: 100,
    },
    shiftItemAmount: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: 4,
    },
    shiftItemConsumables: {
        fontSize: 10,
        color: colors.status.warning,
        marginBottom: 4,
    },
    shiftItemTime: {
        fontSize: 10,
        color: colors.text.secondary,
    },
    shiftItemsEmpty: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
    },
    shiftItemsEmptyText: {
        fontSize: 14,
        color: colors.text.secondary,
    },
});
