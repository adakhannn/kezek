import { StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { layout, radii, space, typeScale } from '../../constants/theme';

/*
 * The public business page (docs/mobile/UI_GUIDE.md): a hero card, KPI tiles, then titled
 * sections on the page with one card level each, and the sticky "Записаться" bar.
 */
export const styles = StyleSheet.create({
    loading: { gap: layout.itemGap },
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: colors.interactive.pressedOpacity },
    ratingWrap: { alignSelf: 'flex-start' },

    hero: { gap: space.md },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    heroText: { flex: 1, minWidth: 0, gap: space.xs },
    title: { ...typeScale.title, color: colors.text.primary },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
    metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
    metaText: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary, flex: 1 },
    notice: { ...typeScale.callout, fontWeight: '400', color: colors.tone.warning.fg },

    // Contact and directory links: pills that wrap inside their card.
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    chip: {
        minHeight: MIN_TOUCH_TARGET,
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radii.pill,
        backgroundColor: colors.fill.input,
    },
    chipText: { ...typeScale.callout, color: colors.text.primary, flexShrink: 1 },

    sectionLink: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: space.xs },
    sectionLinkText: { ...typeScale.callout, fontWeight: '600', color: colors.tone.accent.fg },

    // Rows inside one ListGroup (promotions, services).
    row: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
    },
    rowEnd: { alignItems: 'flex-end', gap: space.xxs, maxWidth: '45%' },
    itemTitle: { ...typeScale.bodyStrong, color: colors.text.primary },
    itemText: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary },
    itemMeta: { ...typeScale.caption, color: colors.text.tertiary },
    price: { ...typeScale.bodyStrong, color: colors.text.primary, textAlign: 'right' },
    more: { ...typeScale.caption, color: colors.text.secondary, textAlign: 'center', paddingVertical: space.md },
    promotionIcon: {
        width: 36,
        height: 36,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.success.bg,
    },

    // One card per branch: name and rating, address, contacts, links.
    branch: { gap: space.md },
    stack: { flex: 1, minWidth: 0, gap: space.xs, alignItems: 'flex-start' },
});
