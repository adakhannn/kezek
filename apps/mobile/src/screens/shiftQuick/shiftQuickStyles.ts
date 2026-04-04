import { StyleSheet } from 'react-native';

import { colors } from '../../constants/colors';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface.page,
    },
    header: {
        padding: colors.layout.space5,
        backgroundColor: colors.surface.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    bannerWrap: {
        paddingHorizontal: colors.layout.space4,
        paddingTop: colors.layout.space4,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    statusCard: {
        margin: colors.layout.space4,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    statusOpen: {
        backgroundColor: colors.status.success,
    },
    statusClosed: {
        backgroundColor: colors.text.tertiary,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
    },
    statusTime: {
        fontSize: 12,
        color: colors.text.secondary,
        marginTop: 4,
    },
    actionsRow: {
        marginTop: colors.layout.space4,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: colors.layout.space4,
        gap: colors.layout.space3,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text.secondary,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text.primary,
    },
    statValueEmployee: {
        color: colors.status.success,
    },
    statHint: {
        fontSize: 10,
        color: colors.text.secondary,
        marginTop: 4,
    },
    addClientCard: {
        margin: colors.layout.space4,
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
    addClientFormTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 4,
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
        marginTop: 4,
    },
    addClientActionButton: {
        flex: 1,
    },
    clientsSection: {
        padding: colors.layout.space4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 12,
    },
    clientCard: {
        marginBottom: colors.layout.space3,
    },
    clientHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    clientName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        flex: 1,
    },
    bookingBadge: {
        marginLeft: 8,
    },
    clientService: {
        fontSize: 14,
        color: colors.text.secondary,
        marginBottom: 8,
    },
    clientAmounts: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    clientAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text.primary,
    },
    clientConsumables: {
        fontSize: 12,
        color: colors.status.warning,
    },
    emptyCard: {
        margin: colors.layout.space4,
    },
    offlineIndicator: {
        paddingHorizontal: colors.layout.space4,
        paddingBottom: colors.layout.space4,
    },
});
