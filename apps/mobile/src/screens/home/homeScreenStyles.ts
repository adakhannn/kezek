import { StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { layout, radii, space, typeScale } from '../../constants/theme';

/*
 * Home (docs/mobile/UI_GUIDE.md): the page background, the 16dp gutter, sections 24 apart, one
 * card level. The navigation header says "Главная"; the hero is one welcome line under it.
 */
export const styles = StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.surface.page },
    listContent: {
        paddingHorizontal: layout.gutter,
        paddingTop: space.lg,
        paddingBottom: layout.tabBarClearance,
    },
    header: { gap: layout.sectionGap, marginBottom: space.md },
    itemGap: { height: layout.itemGap },
    listFooter: { paddingVertical: space.xxl },
    footerBlock: { marginTop: layout.sectionGap },

    hero: { gap: space.xs },
    logo: { alignSelf: 'flex-start', marginLeft: -space.md, marginBottom: space.sm },
    heroTitle: { ...typeScale.title, color: colors.text.primary },
    heroSubtitle: { ...typeScale.body, color: colors.text.secondary },

    clearButton: {
        minWidth: MIN_TOUCH_TARGET,
        minHeight: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: -space.sm,
    },

    sectionAction: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: space.xs },
    sectionActionText: { ...typeScale.callout, fontWeight: '600', color: colors.tone.accent.fg },

    // Upcoming bookings: rows of one ListGroup.
    bookingRow: {
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
    },
    bookingDay: {
        width: 44,
        height: 44,
        borderRadius: radii.md,
        backgroundColor: colors.tone.accent.bg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bookingMain: { flex: 1, minWidth: 0, gap: space.xxs },
    bookingTitle: { ...typeScale.bodyStrong, color: colors.text.primary },
    bookingMeta: { ...typeScale.caption, color: colors.text.secondary },
    bookingWhen: { ...typeScale.caption, color: colors.text.primary, fontWeight: '600' },
    bookingSide: { alignItems: 'flex-end', gap: space.xs, maxWidth: '42%' },
    pressed: { opacity: colors.interactive.pressedOpacity },

    // Recent places: one line of pills that scrolls sideways to the screen edges.
    bleedRow: { marginHorizontal: -layout.gutter, flexGrow: 0 },
    bleedContent: { paddingHorizontal: layout.gutter, gap: space.sm },
    placeChip: {
        minHeight: MIN_TOUCH_TARGET,
        maxWidth: 240,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.lg,
        borderRadius: radii.pill,
        backgroundColor: colors.surface.card,
    },
    placeChipText: { ...typeScale.callout, color: colors.text.primary, flexShrink: 1 },

    // Nearby branches: one card with the status line, the rows and the actions.
    nearbyCard: { gap: space.md },
    nearbyStatus: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
    nearbyIcon: {
        width: 36,
        height: 36,
        borderRadius: radii.md,
        backgroundColor: colors.tone.accent.bg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nearbyIconWarning: { backgroundColor: colors.tone.warning.bg },
    nearbyText: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary, flex: 1 },
    nearbyRows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle },
    nearbyRow: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border.subtle,
    },
    nearbyRowDisabled: { opacity: colors.interactive.disabledOpacity },
    nearbyRowMain: { flex: 1, minWidth: 0, gap: space.xxs },
    nearbyRowName: { ...typeScale.bodyStrong, color: colors.text.primary },
    nearbyRowMeta: { ...typeScale.caption, color: colors.text.secondary },
    nearbyDistance: { ...typeScale.callout, color: colors.tone.accent.fg },
    nearbyMapRow: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
        marginBottom: -space.sm,
    },

    // Business card: one plain card with the initials tile, name, rating, address and tags.
    businessCard: { gap: space.md },
    businessTop: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
    businessLogo: { borderRadius: radii.md },
    businessMain: { flex: 1, minWidth: 0, gap: space.xs },
    businessName: { ...typeScale.headline, color: colors.text.primary },
    businessRating: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
    businessMetaGroup: { gap: space.xs },
    businessMetaRow:{ flexDirection: 'row', alignItems: 'center', gap: space.xs },
    businessMeta: { ...typeScale.caption, color: colors.text.secondary, flexShrink: 1 },
    businessTags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
