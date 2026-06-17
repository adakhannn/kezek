import { StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface.page,
    },
    scrollContent: {
        paddingBottom: colors.layout.space8,
    },
    header: {
        paddingHorizontal: colors.layout.space5,
        paddingTop: colors.layout.space5,
        paddingBottom: colors.layout.space4,
        backgroundColor: colors.surface.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    contentWrap: {
        paddingHorizontal: colors.layout.space4,
        paddingTop: colors.layout.space4,
        paddingBottom: colors.layout.space6,
        gap: colors.layout.space4,
    },
    bannerWrap: {
        marginBottom: colors.layout.space1,
    },
    title: {
        fontSize: 30,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    statusCard: {
        margin: 0,
    },
    statusTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: colors.layout.space2,
        marginBottom: colors.layout.space3,
    },
    statusCardTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text.primary,
    },
    statusPill: {
        borderRadius: colors.layout.radiusXl,
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space1,
        borderWidth: 1,
    },
    statusPillOpen: {
        backgroundColor: colors.feedback.successSurface,
        borderColor: colors.status.success,
    },
    statusPillClosed: {
        backgroundColor: colors.surface.elevated,
        borderColor: colors.border.light,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: '700',
    },
    statusPillTextOpen: {
        color: colors.status.success,
    },
    statusPillTextClosed: {
        color: colors.text.secondary,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: colors.layout.space3,
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 5,
    },
    statusOpen: {
        backgroundColor: colors.status.success,
    },
    statusClosed: {
        backgroundColor: colors.text.tertiary,
    },
    statusIdle: {
        backgroundColor: colors.status.info,
    },
    statusTextWrap: {
        flex: 1,
        gap: 2,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text.primary,
    },
    statusSubtext: {
        fontSize: 13,
        lineHeight: 18,
        color: colors.text.secondary,
    },
    timelineGrid: {
        flexDirection: 'row',
        gap: colors.layout.space3,
        marginTop: colors.layout.space4,
    },
    timelineItem: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        borderRadius: colors.layout.radiusMd,
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space2,
        backgroundColor: colors.surface.elevated,
    },
    timelineLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        color: colors.text.tertiary,
        marginBottom: 4,
    },
    timelineValue: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text.primary,
    },
    queueInlineBanner: {
        marginTop: colors.layout.space4,
    },
    actionsRow: {
        marginTop: colors.layout.space4,
    },
    metricsSection: {
        gap: colors.layout.space3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text.primary,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: colors.layout.space3,
    },
    statCard: {
        flexBasis: '47%',
        flexGrow: 1,
        minHeight: 112,
    },
    statTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: colors.layout.space2,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text.secondary,
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text.primary,
    },
    statValueEmployee: {
        color: colors.status.success,
    },
    statHint: {
        fontSize: 11,
        lineHeight: 16,
        color: colors.text.secondary,
        marginTop: colors.layout.space1,
    },
    addClientCard: {
        margin: 0,
    },
    addClientHeader: {
        marginBottom: colors.layout.space3,
        gap: 2,
    },
    addClientTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text.primary,
    },
    addClientSubtitle: {
        fontSize: 13,
        lineHeight: 18,
        color: colors.text.secondary,
    },
    addClientButton: {
        borderStyle: 'dashed',
        borderColor: colors.accent.primary,
    },
    addClientButtonText: {
        color: colors.accent.primary,
    },
    addClientForm: {
        gap: colors.layout.space3,
    },
    amountRow: {
        flexDirection: 'row',
        gap: colors.layout.space3,
    },
    amountInputContainer: {
        flex: 1,
    },
    addClientActions: {
        flexDirection: 'row',
        gap: colors.layout.space3,
        marginTop: colors.layout.space1,
    },
    addClientActionButton: {
        flex: 1,
    },
    clientsSection: {
        gap: colors.layout.space3,
    },
    clientCard: {
        margin: 0,
    },
    clientHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: colors.layout.space3,
    },
    clientMain: {
        flex: 1,
        gap: 2,
    },
    clientName: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text.primary,
    },
    clientService: {
        fontSize: 13,
        color: colors.text.secondary,
    },
    clientAmountWrap: {
        alignItems: 'flex-end',
        minWidth: 88,
        gap: 2,
    },
    clientAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text.primary,
    },
    clientConsumables: {
        fontSize: 11,
        color: colors.status.warning,
    },
    clientMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: colors.layout.space3,
    },
    clientEditButton: {
        alignSelf: 'flex-start',
        marginTop: colors.layout.space3,
        paddingHorizontal: colors.layout.space3,
        borderColor: colors.accent.primary,
    },
    clientEditButtonText: {
        color: colors.accent.primary,
    },
    sourceChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space1,
        paddingHorizontal: colors.layout.space2,
        paddingVertical: 5,
        borderRadius: colors.layout.radiusXl,
        borderWidth: 1,
    },
    sourceChipBooking: {
        backgroundColor: colors.feedback.successSurface,
        borderColor: colors.status.success,
    },
    sourceChipManual: {
        backgroundColor: colors.surface.elevated,
        borderColor: colors.border.subtle,
    },
    sourceChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.text.secondary,
    },
    clientTime: {
        fontSize: 11,
        color: colors.text.tertiary,
    },
    emptyCard: {
        margin: 0,
    },
    offlineIndicator: {
        marginTop: colors.layout.space1,
    },
    offlineBanner: {
        marginBottom: 0,
    },
});
