import { StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { typography } from '../../constants/typography';

export const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    listContent: {
        paddingBottom: colors.layout.space8,
    },
    businessListItem: {
        paddingHorizontal: colors.layout.space5,
        paddingBottom: colors.layout.space4,
    },
    listFooter: {
        paddingVertical: colors.layout.space4,
    },
    header: {
        padding: colors.layout.space6,
        paddingTop: 32,
        backgroundColor: colors.background.secondary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.dark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        marginBottom: 0,
        width: '100%',
    },
    heroSection: {
        padding: colors.layout.space6,
        paddingTop: 32,
        alignItems: 'center',
    },
    heroTitle: {
        ...typography.display,
        color: colors.text.primary,
        marginBottom: 12,
        textAlign: 'center',
    },
    heroSubtitle: {
        color: colors.text.secondary,
        textAlign: 'center',
        maxWidth: 320,
    },
    offlineBannerWrapper: {
        marginHorizontal: colors.layout.space5,
        marginBottom: colors.layout.space3,
    },
    searchContainer: {
        paddingHorizontal: colors.layout.space5,
        paddingBottom: colors.layout.space4,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.light,
        borderRadius: colors.layout.radiusMd,
        paddingHorizontal: colors.layout.space4,
        ...colors.shadow.sm,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: colors.text.primary,
        paddingVertical: colors.layout.space3,
    },
    clearButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoriesContainer: {
        paddingHorizontal: colors.layout.space5,
        paddingBottom: colors.layout.space5,
    },
    categoriesLabel: {
        ...typography.label,
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: colors.layout.space3,
    },
    categoriesScroll: {
        flexDirection: 'row',
    },
    categoryChip: {
        minHeight: MIN_TOUCH_TARGET,
        marginRight: colors.layout.space2,
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.background.secondary,
        overflow: 'hidden',
    },
    categoryChipActive: {
        borderColor: 'transparent',
    },
    categoryChipGradient: {
        minHeight: MIN_TOUCH_TARGET,
        paddingHorizontal: 16,
        paddingVertical: colors.layout.space2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryChipText: {
        minHeight: MIN_TOUCH_TARGET,
        fontSize: 12,
        fontWeight: '500',
        color: colors.text.secondary,
        paddingHorizontal: 16,
        paddingVertical: colors.layout.space2,
        textAlignVertical: 'center',
    },
    categoryChipTextActive: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.text.light,
    },
    section: {
        paddingHorizontal: colors.layout.space5,
        paddingBottom: colors.layout.space4,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: colors.layout.space2,
    },
    sectionLinkPressable: {
        minHeight: MIN_TOUCH_TARGET,
        borderRadius: colors.layout.radiusSm,
        justifyContent: 'center',
    },
    sectionTitle: {
        ...typography.sectionTitle,
        color: colors.text.primary,
    },
    bookingCardPressable: {
        borderRadius: colors.layout.radiusLg,
    },
    sectionLink: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.primary.from,
    },
    bookingCard: {
        marginTop: colors.layout.space2,
    },
    bookingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: colors.layout.space3,
    },
    bookingMain: {
        flex: 1,
    },
    bookingBusiness: {
        fontSize: typography.body.fontSize,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 2,
    },
    bookingBranch: {
        fontSize: 13,
        color: colors.text.secondary,
        marginBottom: 2,
    },
    bookingService: {
        fontSize: 13,
        color: colors.text.secondary,
        lineHeight: 18,
    },
    bookingMeta: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: colors.layout.space1,
    },
    bookingDate: {
        fontSize: typography.label.fontSize,
        color: colors.text.secondary,
    },
    bookingStatusPill: {
        paddingHorizontal: colors.layout.space2,
        paddingVertical: colors.layout.space1,
        borderRadius: 999,
        backgroundColor: colors.background.secondary,
    },
    bookingStatusText: {
        fontSize: 11,
        fontWeight: '500',
        color: colors.text.secondary,
    },
    recentPlacesRow: {
        paddingTop: colors.layout.space2,
        paddingBottom: colors.layout.space1,
        gap: colors.layout.space2,
    },
    recentPlaceChip: {
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space2,
        borderRadius: 999,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.light,
        marginRight: colors.layout.space2,
    },
    recentPlaceText: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.text.primary,
    },
    nearbyFallbackContainer: {
        paddingHorizontal: colors.layout.space5,
        paddingBottom: colors.layout.space4,
    },
    nearbyFallbackCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: colors.layout.space3,
        borderColor: colors.border.light,
    },
    nearbyFallbackIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.tertiary,
    },
    nearbyFallbackIconWarning: {
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.light,
    },
    nearbyFallbackContent: {
        flex: 1,
    },
    nearbyFallbackTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: colors.layout.space1,
    },
    nearbyFallbackText: {
        fontSize: 13,
        lineHeight: 18,
        color: colors.text.secondary,
    },
    nearbyFallbackHint: {
        marginTop: colors.layout.space3,
        fontSize: 12,
        lineHeight: 17,
        color: colors.text.muted,
    },
    nearbyAction: {
        marginTop: colors.layout.space3,
    },
    nearbyMapAction: {
        marginTop: colors.layout.space2,
    },
    nearbyBranchList: {
        marginTop: colors.layout.space3,
        gap: colors.layout.space2,
    },
    nearbyBranchRow: {
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space3,
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space2,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.background.secondary,
    },
    nearbyBranchRowDisabled: {
        opacity: 0.55,
    },
    nearbyBranchMain: {
        flex: 1,
    },
    nearbyBranchName: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: 2,
    },
    nearbyBranchMeta: {
        fontSize: 12,
        lineHeight: 16,
        color: colors.text.secondary,
    },
    nearbyBranchDistance: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.accent.primary,
    },
    businessList: {
        padding: colors.layout.space5,
        gap: colors.layout.space4,
        paddingBottom: colors.layout.space8,
    },
    businessCard: {
        marginBottom: 0,
    },
    businessHeader: {
        marginBottom: colors.layout.space3,
    },
    businessNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space2,
        flexWrap: 'wrap',
    },
    businessName: {
        ...typography.sectionTitle,
        color: colors.text.primary,
        flex: 1,
    },
    businessInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: colors.layout.space2,
        gap: colors.layout.space2,
    },
    businessAddress: {
        fontSize: 14,
        color: colors.text.secondary,
        flex: 1,
    },
    businessPhone: {
        fontSize: 12,
        color: colors.text.secondary,
        lineHeight: 18,
    },
    businessCategories: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: colors.layout.space2,
        marginTop: colors.layout.space2,
        marginBottom: colors.layout.space4,
    },
    businessCategoryTag: {
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space1,
        borderRadius: colors.layout.radiusMd,
    },
    businessCategoryText: {
        fontSize: 11,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    businessFooter: {
        marginTop: colors.layout.space4,
        paddingTop: colors.layout.space4,
        borderTopWidth: 1,
        borderTopColor: colors.border.dark,
    },
    bookButton: {
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: colors.layout.space3,
        paddingHorizontal: colors.layout.space4,
        borderRadius: colors.layout.radiusSm,
        gap: colors.layout.space2,
        ...colors.shadow.md,
    },
    bookButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.light,
    },
});
