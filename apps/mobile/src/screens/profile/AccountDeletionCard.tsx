import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField from '../../components/ui/FormField';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
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

const BLOCKER_KEYS: Record<string, MobileI18nKey> = {
    super_admin: 'parity.deletion.blocker.super_admin',
    owned_businesses: 'parity.deletion.blocker.owned_businesses',
    business_roles: 'parity.deletion.blocker.business_roles',
    active_staff: 'parity.deletion.blocker.active_staff',
    active_bookings: 'parity.deletion.blocker.active_bookings',
};

export function blockerText(blocker: AccountDeletionBlocker, t: (key: MobileI18nKey) => string): string {
    const key = BLOCKER_KEYS[blocker.code];
    const text = (key ? t(key) : blocker.message).replace(/\.\s*$/, '');
    return `${text} (${blocker.count})`;
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
        <Section title={t('parity.deletion.title')} caption={t('parity.deletion.description')}>
            <Card variant="plain" padding="md" style={styles.card} testID="profile-account-deletion">
                {stateQuery.isError ? (
                    <FeedbackBanner
                        variant="danger"
                        message={t('parity.deletion.error.check')}
                        action={<Button title={t('cabinet.ui.retry')} onPress={() => void stateQuery.refetch()} variant="outline" size="sm" />}
                        style={styles.banner}
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
                        style={styles.banner}
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
                        {/* While something blocks deletion only the reasons show: a field and a red button that cannot be used read as a broken form. */}
                        {state.eligible ? (
                            <>
                                <FormField
                                    label={t('parity.deletion.confirmation.label')}
                                    value={confirmation}
                                    onChangeText={setConfirmation}
                                    placeholder={t('parity.deletion.confirmation.placeholder', { phrase })}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    editable={state.eligible && !busy}
                                    testID="account-deletion-confirmation"
                                    containerStyle={styles.field}
                                />
                                <Button
                                    title={t('parity.deletion.request')}
                                    onPress={() => void submit()}
                                    variant="danger"
                                    fullWidth
                                    loading={requestMutation.isPending}
                                    disabled={!state.eligible || confirmation.trim() !== phrase || busy}
                                />
                            </>
                        ) : null}
                    </View>
                ) : stateQuery.isLoading ? (
                    <Text style={styles.muted}>{t('common.loading')}</Text>
                ) : null}
            </Card>
        </Section>
    );
}

const styles = StyleSheet.create({
    card: { gap: space.md, borderWidth: 1, borderColor: colors.tone.danger.border },
    banner: { marginBottom: 0 },
    block: { gap: space.md },
    field: { marginBottom: 0 },
    blockers: {
        borderRadius: radii.md,
        backgroundColor: colors.tone.warning.bg,
        padding: space.md,
        gap: space.xs,
    },
    blockersTitle: { ...typeScale.callout, color: colors.tone.warning.fg },
    blocker: { ...typeScale.caption, color: colors.text.secondary },
    muted: { ...typeScale.caption, color: colors.text.secondary },
});
