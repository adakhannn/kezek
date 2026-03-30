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
    businessList: {
        padding: 20,
        gap: 12,
    },
    businessCard: {
        marginBottom: 12,
    },
    businessName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    businessAddress: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
    },
    businessPhone: {
        fontSize: 14,
        color: '#6366f1',
        marginBottom: 12,
    },
    businessActions: {
        marginTop: 8,
    },
    actionButton: {
        marginTop: 0,
    },
});
