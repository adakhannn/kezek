import { StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';

export const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    header: {
        padding: 24,
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
        padding: 24,
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
        marginHorizontal: 20,
        marginBottom: 12,
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.light,
        borderRadius: 12,
        paddingHorizontal: 16,
        ...colors.shadow.sm,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: colors.text.primary,
        paddingVertical: 14,
    },
    clearButton: {
        padding: 4,
    },
    categoriesContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    categoriesLabel: {
        ...typography.label,
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    categoriesScroll: {
        flexDirection: 'row',
    },
    categoryChip: {
        marginRight: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.background.secondary,
        overflow: 'hidden',
    },
    categoryChipActive: {
        borderColor: 'transparent',
    },
    categoryChipGradient: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryChipText: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.text.secondary,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    categoryChipTextActive: {
        fontSize: 12,
        fontWeight: '500',
        color: '#fff',
    },
    section: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    sectionLinkPressable: {
        borderRadius: colors.layout.radiusSm,
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
        marginTop: 8,
    },
    bookingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
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
        color: colors.text.tertiary,
    },
    bookingMeta: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 4,
    },
    bookingDate: {
        fontSize: typography.label.fontSize,
        color: colors.text.secondary,
    },
    bookingStatusPill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: colors.background.secondary,
    },
    bookingStatusText: {
        fontSize: 11,
        fontWeight: '500',
        color: colors.text.secondary,
    },
    recentPlacesRow: {
        paddingTop: 8,
        paddingBottom: 4,
        gap: 8,
    },
    recentPlaceChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.light,
        marginRight: 8,
    },
    recentPlaceText: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.text.primary,
    },
    businessList: {
        padding: 20,
        gap: 16,
        paddingBottom: 40,
    },
    businessCard: {
        marginBottom: 0,
    },
    businessHeader: {
        marginBottom: 12,
    },
    businessNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
        marginBottom: 8,
        gap: 8,
    },
    businessAddress: {
        fontSize: 14,
        color: colors.text.secondary,
        flex: 1,
    },
    businessPhone: {
        fontSize: 12,
        color: colors.text.tertiary,
    },
    businessCategories: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
        marginBottom: 16,
    },
    businessCategoryTag: {
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    businessCategoryText: {
        fontSize: 11,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    businessFooter: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border.dark,
    },
    bookButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
        ...colors.shadow.md,
    },
    bookButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
