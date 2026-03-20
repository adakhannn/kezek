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
    },
    loading: {
        textAlign: 'center',
        padding: 40,
        color: '#6b7280',
    },
    card: {
        margin: 20,
        marginBottom: 0,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    emailContainer: {
        marginTop: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    emailValue: {
        fontSize: 16,
        color: '#111827',
        marginBottom: 4,
    },
    emailHint: {
        fontSize: 12,
        color: '#6b7280',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    switchLabelContainer: {
        flex: 1,
        marginRight: 12,
    },
    switchLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 4,
    },
    switchHint: {
        fontSize: 14,
        color: '#6b7280',
    },
    actions: {
        padding: 20,
        paddingBottom: 40,
    },
    signOutButton: {
        marginTop: 12,
        borderColor: '#ef4444',
    },
});
