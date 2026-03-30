import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        padding: 24,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
    },
    section: {
        padding: 24,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 20,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        borderRadius: 999,
        padding: 4,
        marginBottom: 12,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabButtonActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    tabButtonText: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    tabButtonTextActive: {
        color: '#4f46e5',
        fontWeight: '600',
    },
    offlineBanner: {
        marginBottom: 16,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FBBF24',
    },
    offlineBannerText: {
        fontSize: 14,
        color: '#92400E',
    },
    bookingsList: {
        gap: 16,
    },
    bookingCard: {
        marginBottom: 0,
    },
    bookingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    bookingService: {
        fontSize: 20,
        fontWeight: '600',
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
    bookingBusiness: {
        fontSize: 16,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 6,
    },
    bookingStaff: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 6,
    },
    bookingBranch: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 12,
    },
    bookingTime: {
        marginTop: 12,
        paddingTop: 12,
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
    loading: {
        textAlign: 'center',
        padding: 40,
        color: '#6b7280',
    },
    empty: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    emptyHint: {
        fontSize: 14,
        color: '#6b7280',
    },
    footer: {
        padding: 24,
        paddingBottom: 40,
    },
});
