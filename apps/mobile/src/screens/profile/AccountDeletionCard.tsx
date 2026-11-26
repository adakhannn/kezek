import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../utils/format';
import {
    cancelAccountDeletion,
    fetchAccountDeletionState,
    requestAccountDeletion,
    type AccountDeletionBlocker,
} from './profileApi';
import { styles as profileStyles } from './profileScreenStyles';

const BLOCKER_KEYS: Record<string, MobileI18nKey> = {
    super_admin: 'parity.deletion.blocker.super_admin',
    owned_businesses: 'parity.deletion.blocker.owned_businesses',
    business_roles: 'parity.deletion.blocker.business_roles',
    active_staff: 'parity.deletion.blocker.active_staff',
    active_bookings: 'parity.deletion.blocker.active_bookings',
};

export function blockerText(blocker: AccountDeletionBlocker, t: (key: MobileI18nKey) => string): string {
    const key = BLOCKER_KEYS[blocker.code];
    return `${key ? t(key) : blocker.message} (${blocker.count})`;
}

/**
 * Account deletion in the app (App Store 5.1.1(v)), the website's AccountDeletionPanel: what blocks
 * it, the typed confirmation phrase, the 7-day pending request and its cancellation.
 */
export function AccountDeletionCard({ userId }: { userId?: string }) {
    const { t, locale } = useLanguage();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const [confirmation, setConfirmation] = useState('');
    const queryKey = ['account-deletion', userId];

    const stateQuery = useQuery({ queryKey, queryFn: fetchAccountDeletionState, enabled: !!userId });
    const refresh = () => queryClient.invalidateQueries({ queryKey });

    const requestMutation = useMutation({
        mutationFn: () => requestAccountDeletion(confirmation),
        onSuccess: () => {
            setConfirmation('');
            showToast(t('parity.deletion.requested'), 'success');
            void refresh();
        },
        onError: (error: unknown) => showToast(getErrorMessage(error, t('parity.deletion.error.request'), t), 'error'),
    });

    const cancelMutation = useMutation({
        mutationFn: cancelAccountDeletion,
        onSuccess: () => {
            showToast(t('parity.deletion.cancelled'), 'success');
            void refresh();
        },
        onError: (error: unknown) => showToast(getErrorMessage(error, t('parity.deletion.error.cancel'), t), 'error'),
    });

    const state = stateQuery.data;
    const phrase = t('parity.deletion.confirmationPhrase');
    const pending = state?.request?.status === 'pending';
    const busy = requestMutation.isPending || cancelMutation.isPending;
    const scheduledFor = state?.request?.scheduled_for
        ? formatDateTime(state.request.scheduled_for, true, locale)
        : '';

    const submit = async () => {
        const proceed = await confirm({
            title: t('cabinet.profile.account.deleteConfirmTitle'),
            message: t('parity.deletion.confirmMessage'),
            confirmLabel: t('parity.deletion.request'),
            cancelLabel: t('cabinet.ui.cancel'),
            variant: 'danger',
        });
        if (proceed) requestMutation.mutate();
    };

    return (
        <Card style={[profileStyles.card, styles.card]} testID="profile-account-deletion">
            <Text style={[profileStyles.sectionTitle, styles.title]}>{t('parity.deletion.title')}</Text>
            <Text style={profileStyles.switchHint}>{t('parity.deletion.description')}</Text>

            {stateQuery.isError ? (
                <FeedbackBanner
                    variant="danger"
                    message={t('parity.deletion.error.check')}
                    action={<Button title={t('cabinet.ui.retry')} onPress={() => void stateQuery.refetch()} variant="outline" size="sm" />}
                    style={styles.block}
                />
            ) : null}

            {pending ? (
                <FeedbackBanner
                    variant="warning"
                    title={t('parity.deletion.pending.title')}
                    message={t('parity.deletion.pending.message', { date: scheduledFor })}
                    action={(
                        <Button
                            title={t('parity.deletion.cancel')}
                            onPress={() => cancelMutation.mutate()}
                            variant="outline"
                            size="sm"
                            loading={cancelMutation.isPending}
                            disabled={busy}
                        />
                    )}
                    style={styles.block}
                />
            ) : state ? (
                <View style={styles.block}>
                    {state.blockers.length ? (
                        <View style={styles.blockers}>
                            <Text style={styles.blockersTitle}>{t('parity.deletion.blocked.title')}</Text>
                            {state.blockers.map((blocker) => (
                                <Text key={blocker.code} style={styles.blocker}>• {blockerText(blocker, t)}</Text>
                            ))}
                        </View>
                    ) : null}
                    <Input
                        label={t('parity.deletion.confirmation.label')}
                        value={confirmation}
                        onChangeText={setConfirmation}
                        placeholder={t('parity.deletion.confirmation.placeholder', { phrase })}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        editable={state.eligible && !busy}
                        testID="account-deletion-confirmation"
                    />
                    <Button
                        title={t('parity.deletion.request')}
                        onPress={() => void submit()}
                        variant="danger"
                        fullWidth
                        loading={requestMutation.isPending}
                        disabled={!state.eligible || confirmation.trim() !== phrase || busy}
                    />
                </View>
            ) : null}
        </Card>
    );
}

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.45)' },
    title: { color: colors.status.danger, marginBottom: colors.layout.space2 },
    block: { marginTop: colors.layout.space3, gap: colors.layout.space3 },
    blockers: {
        borderRadius: colors.layout.radiusMd,
        backgroundColor: colors.feedback.warningSurface,
        padding: 12,
        gap: 4,
    },
    blockersTitle: { fontSize: 14, fontWeight: '600', color: colors.status.warning },
    blocker: { fontSize: 13, color: colors.text.secondary },
});
