import { StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    content: {
        paddingBottom: 160,
    },
    header: {
        padding: colors.layout.space5,
        backgroundColor: colors.surface.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    section: {
        padding: colors.layout.space5,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
        marginTop: colors.layout.space5,
        marginBottom: colors.layout.space3,
    },
    businessChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: colors.layout.space2,
        marginBottom: colors.layout.space3,
    },
    businessChip: {
        minHeight: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: colors.layout.space4,
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.surface.card,
    },
    businessChipSelected: {
        borderColor: colors.accent.primary,
        backgroundColor: colors.surface.emphasis,
    },
    businessChipText: {
        fontSize: 15,
        color: colors.text.secondary,
    },
    businessChipTextSelected: {
        color: colors.text.primary,
        fontWeight: '600',
    },
    businessCard: {
        marginBottom: 0,
    },
    businessName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: 4,
    },
    businessRole: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.accent.indigo,
        marginBottom: 8,
    },
    businessAddress: {
        fontSize: 14,
        color: colors.text.secondary,
        marginBottom: 4,
    },
    webHint: {
        fontSize: 13,
        color: colors.text.tertiary,
        marginTop: 4,
    },
    businessActions: {
        marginTop: colors.layout.space3,
    },
    bookingsList: {
        gap: colors.layout.space3,
    },
    bookingCard: {
        marginBottom: 0,
    },
    bookingHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: colors.layout.space2,
        marginBottom: 6,
    },
    bookingTime: {
        flexShrink: 1,
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
    },
    bookingService: {
        fontSize: 16,
        color: colors.text.primary,
        marginBottom: 4,
    },
    bookingMeta: {
        fontSize: 14,
        color: colors.text.secondary,
        marginBottom: 2,
    },
    bookingActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: colors.layout.space2,
        marginTop: colors.layout.space3,
    },
    bookingAction: {
        flexGrow: 1,
    },
});
