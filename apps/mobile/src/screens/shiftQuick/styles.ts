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
    statusCard: {
        margin: 16,
        padding: 16,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    statusOpen: {
        backgroundColor: '#10b981',
    },
    statusClosed: {
        backgroundColor: '#6b7280',
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    statusTime: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    actionsRow: {
        marginTop: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    openButton: {
        backgroundColor: '#10b981',
    },
    closeButton: {
        backgroundColor: '#ef4444',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
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
    statHint: {
        fontSize: 10,
        color: '#6b7280',
        marginTop: 4,
    },
    addClientCard: {
        margin: 16,
        padding: 16,
    },
    addClientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#4f46e5',
        borderStyle: 'dashed',
        gap: 8,
    },
    addClientButtonText: {
        color: '#4f46e5',
        fontSize: 16,
        fontWeight: '600',
    },
    addClientForm: {
        gap: 12,
    },
    addClientFormTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    amountRow: {
        flexDirection: 'row',
        gap: 12,
    },
    amountInput: {
        flex: 1,
    },
    addClientActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    addClientActionButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f3f4f6',
    },
    cancelButtonText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#4f46e5',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    clientsSection: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    clientCard: {
        marginBottom: 12,
        padding: 16,
    },
    clientHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    clientName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    bookingBadge: {
        marginLeft: 8,
    },
    clientService: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 8,
    },
    clientAmounts: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    clientAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    clientConsumables: {
        fontSize: 12,
        color: '#d97706',
    },
    emptyCard: {
        margin: 16,
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 8,
    },
    emptyHint: {
        fontSize: 12,
        color: '#9ca3af',
    },
    offlineIndicator: {
        padding: 12,
        backgroundColor: '#fef3c7',
        borderTopWidth: 1,
        borderTopColor: '#fbbf24',
    },
    offlineText: {
        fontSize: 12,
        color: '#92400e',
        textAlign: 'center',
    },
});
