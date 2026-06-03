import { StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    content: {
        // Keep footer actions fully above bottom tab bar on smaller screens.
        paddingBottom: 140,
    },
    header: {
        paddingHorizontal: colors.layout.space6,
        paddingTop: colors.layout.space6,
        paddingBottom: colors.layout.space4,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: colors.layout.space4,
    },
    headerTextWrap: {
        flex: 1,
    },
    eyebrow: {
        ...typography.label,
        color: colors.accent.secondary,
        marginBottom: colors.layout.space2,
    },
    title: {
        ...typography.pageTitle,
        color: colors.text.primary,
        marginBottom: colors.layout.space2,
    },
    subtitle: {
        ...typography.body,
        color: colors.text.secondary,
    },
    overviewCard: {
        marginHorizontal: colors.layout.space6,
        marginBottom: colors.layout.space4,
        backgroundColor: colors.surface.emphasis,
        borderColor: colors.border.subtle,
    },
    overviewTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: colors.layout.space4,
        marginBottom: colors.layout.space4,
    },
    overviewCopy: {
        flex: 1,
    },
    overviewLabel: {
        ...typography.label,
        color: colors.text.secondary,
        marginBottom: colors.layout.space2,
    },
    overviewTitle: {
        ...typography.sectionTitle,
        color: colors.text.primary,
        marginBottom: colors.layout.space2,
    },
    overviewDescription: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    overviewMetaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space2,
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space2,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.card,
    },
    overviewMetaText: {
        ...typography.label,
        color: colors.text.secondary,
    },
    statsRow: {
        flexDirection: 'row',
        gap: colors.layout.space3,
    },
    statCard: {
        flex: 1,
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        backgroundColor: colors.surface.card,
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    statValue: {
        ...typography.sectionTitle,
        color: colors.text.primary,
        marginBottom: 2,
    },
    statLabel: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    offlineBanner: {
        marginHorizontal: colors.layout.space6,
        marginBottom: colors.layout.space4,
    },
    syncCard: {
        marginHorizontal: colors.layout.space6,
        marginBottom: colors.layout.space4,
        borderColor: colors.border.subtle,
    },
    syncRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space3,
    },
    syncIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.feedback.infoSurface,
    },
    syncCopy: {
        flex: 1,
    },
    syncTitle: {
        ...typography.label,
        color: colors.text.primary,
        marginBottom: 2,
    },
    syncText: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    sectionHeader: {
        paddingHorizontal: colors.layout.space6,
        marginBottom: colors.layout.space3,
    },
    sectionTitle: {
        ...typography.sectionTitle,
        color: colors.text.primary,
        marginBottom: colors.layout.space2,
    },
    sectionDescription: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    tabsContainer: {
        flexDirection: 'row',
        gap: colors.layout.space3,
        paddingHorizontal: colors.layout.space6,
        marginBottom: colors.layout.space4,
    },
    tabButton: {
        flex: 1,
        borderRadius: colors.layout.radiusLg,
        paddingHorizontal: colors.layout.space4,
        paddingVertical: colors.layout.space3,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.card,
        gap: 2,
    },
    tabButtonActive: {
        backgroundColor: colors.surface.emphasis,
        borderColor: colors.accent.primary,
    },
    tabLabel: {
        ...typography.label,
        color: colors.text.secondary,
    },
    tabLabelActive: {
        color: colors.text.primary,
    },
    tabCount: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    tabCountActive: {
        color: colors.accent.primary,
    },
    bookingsList: {
        gap: colors.layout.space4,
        paddingHorizontal: colors.layout.space6,
    },
    bookingPressable: {
        borderRadius: colors.layout.radiusLg,
    },
    bookingCard: {
        marginBottom: 0,
        gap: colors.layout.space4,
    },
    bookingHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: colors.layout.space3,
    },
    bookingTitleWrap: {
        flex: 1,
        gap: colors.layout.space1,
    },
    bookingService: {
        ...typography.sectionTitle,
        color: colors.text.primary,
    },
    bookingBusiness: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    statusBadge: {
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space2,
        borderRadius: 999,
    },
    statusText: {
        ...typography.label,
        color: colors.text.light,
    },
    timelineCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space3,
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        backgroundColor: colors.surface.emphasis,
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    timelineIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.feedback.infoSurface,
    },
    timelineCopy: {
        flex: 1,
    },
    timelineLabel: {
        ...typography.label,
        color: colors.text.secondary,
        marginBottom: 2,
    },
    timelineValue: {
        ...typography.body,
        color: colors.text.primary,
    },
    metaGrid: {
        gap: colors.layout.space3,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space2,
    },
    metaText: {
        ...typography.caption,
        color: colors.text.secondary,
        flex: 1,
    },
    bookingFooter: {
        paddingTop: colors.layout.space3,
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
    },
    footerHint: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    empty: {
        marginHorizontal: colors.layout.space6,
        paddingVertical: colors.layout.space8,
    },
    footer: {
        paddingHorizontal: colors.layout.space6,
        paddingTop: colors.layout.space5,
        paddingBottom: colors.layout.space6,
        gap: colors.layout.space3,
    },
    signOutQuickButton: {
        borderColor: colors.status.danger,
    },
});
