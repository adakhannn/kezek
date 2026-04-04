import { StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        padding: 24,
        backgroundColor: colors.background.secondary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    title: {
        ...typography.pageTitle,
        color: colors.text.primary,
        marginBottom: 8,
    },
    subtitle: {
        ...typography.body,
        color: colors.text.secondary,
    },
    section: {
        padding: 24,
    },
    sectionTitle: {
        ...typography.sectionTitle,
        color: colors.text.primary,
        marginBottom: 20,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: colors.background.tertiary,
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
        backgroundColor: colors.background.secondary,
        ...colors.shadow.sm,
    },
    tabButtonText: {
        ...typography.caption,
        fontWeight: '500',
        color: colors.text.secondary,
    },
    tabButtonTextActive: {
        color: colors.accent.primary,
        fontWeight: '600',
    },
    offlineBanner: {
        marginBottom: 16,
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.feedback.warningSurface,
        borderWidth: 1,
        borderColor: colors.status.warning,
    },
    offlineBannerText: {
        ...typography.caption,
        color: colors.status.warning,
    },
    bookingsList: {
        gap: 16,
    },
    bookingCard: {
        marginBottom: 0,
    },
    bookingPressable: {
        borderRadius: colors.layout.radiusLg,
    },
    bookingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    bookingService: {
        ...typography.sectionTitle,
        color: colors.text.primary,
        flex: 1,
        marginRight: 12,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        ...typography.label,
        fontWeight: '600',
        color: colors.text.inverse,
    },
    bookingBusiness: {
        ...typography.body,
        fontWeight: '500',
        color: colors.text.secondary,
        marginBottom: 6,
    },
    bookingStaff: {
        ...typography.caption,
        color: colors.text.secondary,
        marginBottom: 6,
    },
    bookingBranch: {
        ...typography.caption,
        color: colors.text.secondary,
        marginBottom: 12,
    },
    bookingTime: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
    },
    bookingDate: {
        ...typography.caption,
        fontWeight: '500',
        color: colors.text.primary,
        marginBottom: 4,
    },
    bookingTimeRange: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    loading: {
        textAlign: 'center',
        padding: 40,
        color: colors.text.secondary,
    },
    empty: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        ...typography.sectionTitle,
        color: colors.text.secondary,
        marginBottom: 8,
    },
    emptyHint: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    footer: {
        padding: 24,
        paddingBottom: 40,
    },
});
