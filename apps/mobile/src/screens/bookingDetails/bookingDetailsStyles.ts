import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    card: {
        margin: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    serviceName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        flex: 1,
        marginRight: 12,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    section: {
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    timelineSection: {
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b7280',
        marginBottom: 4,
    },
    value: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    phone: {
        fontSize: 14,
        color: '#6366f1',
    },
    address: {
        fontSize: 14,
        color: '#6b7280',
    },
    time: {
        fontSize: 16,
        color: '#374151',
        marginTop: 4,
    },
    duration: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    price: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#10b981',
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        columnGap: 4,
    },
    timelineStep: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timelineDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#d1d5db',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    timelineDotDone: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
    },
    timelineDotText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '700',
    },
    timelineLabel: {
        fontSize: 11,
        color: '#6b7280',
        marginLeft: 4,
        marginRight: 4,
    },
    timelineConnector: {
        width: 16,
        height: 1,
        backgroundColor: '#e5e7eb',
    },
    actions: {
        padding: 20,
        paddingBottom: 40,
        gap: 12,
    },
    primaryAction: {
        marginBottom: 4,
    },
    cancelButton: {
        borderColor: '#ef4444',
    },
    contactRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    contactButton: {
        flex: 1,
    },
});
