import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
    },
    filters: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    periodButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    periodButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    periodButtonActive: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
    },
    periodButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    periodButtonTextActive: {
        color: '#fff',
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
        color: '#6b7280',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    statValueEmployee: {
        color: '#059669',
    },
    statValueBusiness: {
        color: '#4f46e5',
    },
    statPercent: {
        fontSize: 12,
        color: '#6b7280',
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
        color: '#6b7280',
        marginBottom: 4,
    },
    additionalStatValue: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    shiftsSection: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
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
        color: '#111827',
    },
    shiftStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    shiftStatusOpen: {
        backgroundColor: '#d1fae5',
    },
    shiftStatusClosed: {
        backgroundColor: '#f3f4f6',
    },
    shiftStatusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    shiftStatusTextOpen: {
        color: '#059669',
    },
    shiftStatusTextClosed: {
        color: '#374151',
    },
    shiftClientsCount: {
        fontSize: 12,
        color: '#6b7280',
    },
    shiftTime: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    shiftHeaderRight: {
        alignItems: 'flex-end',
        minWidth: 140,
    },
    shiftTotalAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    shiftConsumables: {
        fontSize: 10,
        color: '#6b7280',
        marginBottom: 4,
    },
    shiftFinancials: {
        marginTop: 4,
    },
    shiftMasterShare: {
        fontSize: 10,
        color: '#374151',
        marginBottom: 2,
    },
    shiftMasterShareGuaranteed: {
        fontSize: 10,
        color: '#059669',
        fontWeight: '600',
        marginBottom: 2,
    },
    shiftBaseShareStriked: {
        fontSize: 10,
        color: '#9ca3af',
        textDecorationLine: 'line-through',
        marginBottom: 2,
    },
    shiftGuaranteed: {
        fontSize: 10,
        color: '#6b7280',
        marginBottom: 2,
    },
    shiftHours: {
        fontSize: 10,
        color: '#d97706',
        marginBottom: 2,
    },
    shiftSalonShare: {
        fontSize: 10,
        color: '#374151',
    },
    shiftItems: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    shiftItemsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    shiftItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: '#f9fafb',
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
        backgroundColor: '#10b981',
    },
    shiftItemInfo: {
        flex: 1,
    },
    shiftItemClient: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    shiftItemService: {
        fontSize: 12,
        color: '#374151',
    },
    shiftItemRight: {
        alignItems: 'flex-end',
        minWidth: 100,
    },
    shiftItemAmount: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    shiftItemConsumables: {
        fontSize: 10,
        color: '#d97706',
        marginBottom: 4,
    },
    shiftItemTime: {
        fontSize: 10,
        color: '#6b7280',
    },
    shiftItemsEmpty: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    shiftItemsEmptyText: {
        fontSize: 14,
        color: '#6b7280',
    },
});
