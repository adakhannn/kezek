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
    card: {
        margin: 20,
        marginBottom: 0,
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    branchName: {
        fontSize: 18,
        fontWeight: '500',
        color: '#374151',
    },
    businessName: {
        fontSize: 18,
        fontWeight: '500',
        color: '#374151',
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
        color: '#111827',
        marginBottom: 8,
    },
    bookingClient: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 4,
    },
    bookingPhone: {
        fontSize: 14,
        color: '#6366f1',
        marginBottom: 8,
    },
    bookingTime: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    bookingDate: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 4,
    },
    bookingTimeRange: {
        fontSize: 14,
        color: '#6b7280',
    },
    shiftsButton: {
        backgroundColor: '#4f46e5',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    shiftsButtonSecondary: {
        backgroundColor: '#f3f4f6',
    },
    shiftsButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    shiftsButtonTextSecondary: {
        color: '#374151',
        fontSize: 16,
        fontWeight: '600',
    },
});
