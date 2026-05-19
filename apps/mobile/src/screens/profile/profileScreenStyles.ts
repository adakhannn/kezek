import { StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';

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
    title: {
        ...typography.pageTitle,
        color: colors.text.primary,
    },
    card: {
        margin: colors.layout.space5,
        marginBottom: 0,
    },
    sectionTitle: {
        ...typography.sectionTitle,
        color: colors.text.primary,
        marginBottom: colors.layout.space4,
    },
    emailContainer: {
        marginTop: colors.layout.space2,
    },
    label: {
        ...typography.caption,
        fontWeight: '500',
        color: colors.text.secondary,
        marginBottom: colors.layout.space2,
    },
    emailValue: {
        ...typography.body,
        color: colors.text.primary,
        marginBottom: colors.layout.space1,
    },
    emailHint: {
        ...typography.label,
        color: colors.text.secondary,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: colors.layout.space3,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    switchLabelContainer: {
        flex: 1,
        marginRight: colors.layout.space3,
    },
    switchLabel: {
        ...typography.body,
        fontWeight: '500',
        color: colors.text.primary,
        marginBottom: colors.layout.space1,
    },
    switchHint: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    actions: {
        padding: colors.layout.space5,
        paddingBottom: colors.layout.space8,
    },
    signOutButton: {
        marginTop: colors.layout.space3,
        borderColor: colors.status.danger,
    },
});
