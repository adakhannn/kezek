import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import { space, typeScale } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useLanguage } from '../../i18n';
import { apiRequest } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';

export type StaffInvitation = {
    id: string;
    business_name: string | null;
    branch_name: string | null;
};

type ListEnvelope = { ok?: boolean; data?: { invitations?: StaffInvitation[] } };
type AcceptEnvelope = { ok?: boolean; data?: { is_active?: boolean } };

type Notice = { kind: 'accepted'; active: boolean } | { kind: 'declined' } | { kind: 'error'; message: string };

export async function loadStaffInvitations(): Promise<StaffInvitation[]> {
    const response = await apiRequest<ListEnvelope>('/staff-invitations');
    return Array.isArray(response?.data?.invitations) ? response.data.invitations : [];
}

/**
 * Invitations to join a business team (C13, API-06), like the web StaffInvitationsBlock: the
 * invited person accepts or declines their own. Renders nothing while there is nothing to answer;
 * a failed load shows nothing rather than an error over the bookings.
 */
export function StaffInvitationsBlock({ userId }: { userId: string }) {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const [notice, setNotice] = useState<Notice | null>(null);

    const query = useQuery({
        queryKey: ['staff-invitations', userId],
        queryFn: loadStaffInvitations,
    });

    const decide = useMutation({
        mutationFn: async ({ id, action }: { id: string; action: 'accept' | 'decline' }) => {
            const response = await apiRequest<AcceptEnvelope>(`/staff-invitations/${encodeURIComponent(id)}/${action}`, {
                method: 'POST',
            });
            return { action, active: response?.data?.is_active !== false };
        },
        onSuccess: ({ action, active }) => {
            setNotice(action === 'accept' ? { kind: 'accepted', active } : { kind: 'declined' });
            if (action === 'accept') {
                // The staff role and cabinet appear for this account now.
                void queryClient.invalidateQueries({ queryKey: ['user-role'] });
                void queryClient.invalidateQueries({ queryKey: ['staff-records'] });
            }
        },
        onError: (error: unknown) => {
            setNotice({ kind: 'error', message: getErrorMessage(error, t('cabinet.invitations.error'), t) });
        },
        onSettled: () => {
            void query.refetch();
        },
    });

    const invitations = query.data ?? [];
    if (invitations.length === 0 && !notice) return null;

    const handleDecline = async (id: string) => {
        const proceed = await confirm({
            title: t('cabinet.invitations.declineTitle'),
            message: t('cabinet.invitations.declineMessage'),
            confirmLabel: t('cabinet.invitations.decline'),
            cancelLabel: t('cabinet.ui.cancel'),
            variant: 'danger',
        });
        if (proceed) decide.mutate({ id, action: 'decline' });
    };

    const busyId = decide.isPending ? decide.variables?.id ?? null : null;

    return (
        <Section
            title={t('cabinet.invitations.title')}
            caption={invitations.length > 0 ? t('cabinet.invitations.hint') : undefined}
            testID="staff-invitations-block"
        >
            {notice ? (
                <Text style={notice.kind === 'error' ? styles.error : styles.success} accessibilityRole="alert">
                    {notice.kind === 'error'
                        ? notice.message
                        : notice.kind === 'declined'
                          ? t('cabinet.invitations.declined')
                          : t(notice.active ? 'cabinet.invitations.accepted' : 'cabinet.invitations.acceptedInactive')}
                </Text>
            ) : null}
            {invitations.map((invitation) => (
                <Card key={invitation.id} variant="plain" padding="md" style={styles.item} testID={`staff-invitation-${invitation.id}`}>
                    <Text style={styles.itemTitle}>{invitation.business_name || t('cabinet.invitations.unknownBusiness')}</Text>
                    {invitation.branch_name ? (
                        <Text style={styles.hint}>{t('cabinet.invitations.branch', { branch: invitation.branch_name })}</Text>
                    ) : null}
                    <View style={styles.actions}>
                        <Button
                            title={t('cabinet.invitations.accept')}
                            onPress={() => decide.mutate({ id: invitation.id, action: 'accept' })}
                            loading={busyId === invitation.id && decide.variables?.action === 'accept'}
                            disabled={decide.isPending}
                            size="sm"
                            style={styles.action}
                        />
                        <Button
                            title={t('cabinet.invitations.decline')}
                            onPress={() => void handleDecline(invitation.id)}
                            loading={busyId === invitation.id && decide.variables?.action === 'decline'}
                            disabled={decide.isPending}
                            variant="outline"
                            size="sm"
                            style={styles.action}
                        />
                    </View>
                </Card>
            ))}
        </Section>
    );
}

const styles = StyleSheet.create({
    hint: { ...typeScale.caption, color: colors.text.secondary },
    success: { ...typeScale.callout, color: colors.tone.success.fg },
    error: { ...typeScale.callout, color: colors.tone.danger.fg },
    item: { gap: space.xs },
    itemTitle: { ...typeScale.bodyStrong, color: colors.text.primary },
    actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
    action: { flex: 1 },
});
