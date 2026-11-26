import { StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface.page,
    },
    content: {
        padding: colors.layout.space5,
        paddingBottom: colors.layout.space8 * 3,
        gap: colors.layout.space4,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: colors.surface.page,
        padding: colors.layout.space5,
    },
    previewName: {
        ...typography.pageTitle,
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: colors.layout.space4,
    },
    hero: {
        gap: colors.layout.space3,
    },
    badges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: colors.layout.space2,
    },
    badge: {
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space1,
    },
    badge_accent: {
        borderColor: colors.accent.indigo,
        backgroundColor: 'rgba(99, 102, 241, 0.16)',
    },
    badge_success: {
        borderColor: colors.status.success,
        backgroundColor: colors.feedback.successSurface,
    },
    badge_info: {
        borderColor: colors.status.info,
        backgroundColor: colors.feedback.infoSurface,
    },
    badge_neutral: {
        borderColor: colors.border.light,
        backgroundColor: colors.surface.elevated,
    },
    badgeText: {
        ...typography.label,
        fontSize: 12,
        color: colors.text.primary,
    },
    title: {
        ...typography.pageTitle,
        color: colors.text.primary,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: colors.layout.space2,
    },
    metaText: {
        ...typography.caption,
        color: colors.text.secondary,
        flexShrink: 1,
    },
    notice: {
        ...typography.body,
        color: colors.text.secondary,
    },
    bookButton: {
        marginTop: colors.layout.space2,
    },
    section: {
        gap: colors.layout.space2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: colors.layout.space2,
    },
    sectionTitle: {
        ...typography.sectionTitle,
        color: colors.text.primary,
    },
    sectionBody: {
        marginTop: colors.layout.space2,
        gap: colors.layout.space3,
    },
    count: {
        ...typography.label,
        color: colors.text.secondary,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space1,
    },
    metrics: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: colors.layout.space3,
    },
    metric: {
        flexGrow: 1,
        flexBasis: '45%',
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.elevated,
        padding: colors.layout.space3,
    },
    metricValue: {
        ...typography.metric,
        color: colors.text.primary,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space3,
    },
    rowEnd: {
        alignItems: 'flex-end',
    },
    flex: {
        flex: 1,
        minWidth: 0,
    },
    itemTitle: {
        ...typography.label,
        color: colors.text.primary,
    },
    itemText: {
        ...typography.caption,
        color: colors.text.secondary,
        marginTop: 2,
    },
    itemMeta: {
        ...typography.caption,
        color: colors.text.tertiary,
        marginTop: 2,
    },
    price: {
        ...typography.label,
        color: colors.text.primary,
    },
    more: {
        ...typography.caption,
        color: colors.text.tertiary,
        textAlign: 'center',
    },
    branch: {
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.elevated,
        padding: colors.layout.space3,
        gap: colors.layout.space3,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: colors.layout.space2,
    },
    chip: {
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space1,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        paddingHorizontal: colors.layout.space3,
    },
    chipText: {
        ...typography.caption,
        color: colors.text.primary,
    },
    promotion: {
        flexDirection: 'row',
        gap: colors.layout.space3,
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.status.success,
        backgroundColor: colors.feedback.successSurface,
        padding: colors.layout.space3,
    },
    promotionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.feedback.successSurface,
    },
    promotionIconText: {
        ...typography.label,
        color: colors.status.success,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface.emphasis,
    },
    avatarText: {
        ...typography.label,
        color: colors.text.secondary,
    },
});
