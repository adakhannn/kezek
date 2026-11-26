import { StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';

/* One booking (docs/mobile/UI_GUIDE.md): an accent hero, then sections with one card level. */
export const styles = StyleSheet.create({
    banner: { marginBottom: 0 },

    hero: { gap: space.sm },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
    serviceName: { ...typeScale.title, color: colors.text.primary, flex: 1, minWidth: 0 },
    when: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
    date: { ...typeScale.bodyStrong, color: colors.text.primary },
    time: { ...typeScale.display, color: colors.text.primary, fontVariant: ['tabular-nums'] },
    duration: { ...typeScale.caption, color: colors.text.secondary },

    timelineRow: {
        flexDirection: 'row',
        padding: space.lg,
        borderRadius: radii.lg,
        backgroundColor: colors.surface.card,
    },
    timelineStep: { flex: 1, alignItems: 'center', gap: space.sm },
    timelineConnector: {
        position: 'absolute',
        top: 11,
        right: '50%',
        left: '-50%',
        height: 2,
        backgroundColor: colors.fill.track,
    },
    timelineConnectorDone: { backgroundColor: colors.accent.primary },
    timelineDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.border.strong,
        backgroundColor: colors.surface.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineDotDone: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    timelineLabel: { ...typeScale.caption, color: colors.text.tertiary, textAlign: 'center' },
    timelineLabelDone: { color: colors.text.primary },

    serviceRow: { minHeight: 48, justifyContent: 'center', paddingVertical: space.md },
    serviceLine: { ...typeScale.body, color: colors.text.primary },

    benefit: { gap: space.sm },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    benefitLine: { ...typeScale.callout, fontWeight: '400', color: colors.text.primary, flexShrink: 1 },
    total: { ...typeScale.headline, color: colors.tone.success.fg, marginTop: space.xs },

    review: { gap: space.sm },
    stars: { fontSize: 20, letterSpacing: 2, color: colors.tone.warning.fg },
    reviewText: { ...typeScale.body, color: colors.text.secondary },

    notice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.md,
        backgroundColor: colors.tone.info.bg,
    },
    noticeText: { ...typeScale.callout, fontWeight: '400', color: colors.text.primary, flex: 1 },
});
