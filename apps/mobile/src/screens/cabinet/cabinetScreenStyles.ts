import { StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { layout, radii, space, typeScale } from '../../constants/theme';

/*
 * The client cabinet (docs/mobile/UI_GUIDE.md): `Screen` gives the page background, the 16dp
 * gutter and sections 24 apart; one card level. The header says "Личный кабинет"; the screen
 * opens with the person.
 */
export const styles = StyleSheet.create({
    pressed: { opacity: colors.interactive.pressedOpacity },
    banner: { marginBottom: 0 },

    hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: MIN_TOUCH_TARGET },
    heroText: { flex: 1, minWidth: 0, gap: space.xxs },
    heroName: { ...typeScale.headline, color: colors.text.primary },
    heroLink: { ...typeScale.callout, color: colors.tone.accent.fg },

    nextCard: { gap: space.sm },
    nextTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    nextIcon: {
        width: 40,
        height: 40,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accent.primary,
    },
    nextText: { flex: 1, minWidth: 0, gap: space.xxs },
    nextLabel: { ...typeScale.overline, color: colors.tone.accent.fg },
    nextTitle: { ...typeScale.headline, color: colors.text.primary },
    nextWhen: { ...typeScale.bodyStrong, color: colors.text.primary },
    nextMeta: { ...typeScale.caption, color: colors.text.secondary },

    tabs: {
        flexDirection: 'row',
        padding: space.xs,
        gap: space.xs,
        borderRadius: radii.md,
        backgroundColor: colors.surface.card,
    },
    tab: {
        flex: 1,
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        paddingHorizontal: space.sm,
        borderRadius: radii.sm,
    },
    tabSelected: { backgroundColor: colors.accent.primary },
    tabLabel: { ...typeScale.callout, color: colors.text.secondary, flexShrink: 1 },
    tabLabelSelected: { color: colors.text.light, fontWeight: '600' },
    tabCount: {
        minWidth: 22,
        paddingHorizontal: space.xs,
        borderRadius: radii.pill,
        alignItems: 'center',
        backgroundColor: colors.fill.track,
    },
    tabCountSelected: { backgroundColor: 'rgba(255, 255, 255, 0.22)' },
    tabCountText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.text.secondary },

    bookingsList: { gap: layout.itemGap },
    bookingCard: { gap: space.md },
    bookingHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
    bookingTitleWrap: { flex: 1, minWidth: 0, gap: space.xxs },
    bookingService: { ...typeScale.bodyStrong, color: colors.text.primary },
    bookingBusiness: { ...typeScale.caption, color: colors.text.secondary },
    whenRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    whenText: { ...typeScale.callout, color: colors.text.primary, flexShrink: 1 },
    metaGroup: { gap: space.xs },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    metaText: { ...typeScale.caption, color: colors.text.secondary, flexShrink: 1 },
    benefitText: { color: colors.tone.success.fg },
    bookingFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.md,
        paddingTop: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    footerHint: { ...typeScale.caption, color: colors.text.secondary, flexShrink: 1 },
    loadMore: { alignItems: 'center', gap: space.sm },
});
