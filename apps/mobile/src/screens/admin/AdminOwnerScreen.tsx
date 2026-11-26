import { useState } from 'react';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ActionBar from '../../components/ui/ActionBar';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import { SkeletonList } from '../../components/ui/Skeleton';
import { colors } from '../../constants/colors';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { adminApi, adminKeys, type AdminUserMini } from './adminApi';
import { ownersChanged, userContacts, userLabel } from './adminLogic';
import { AdminQuery, adminErrorText, adminStyles, useDebouncedValue } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminOwner'>;

/** The website's /admin/businesses/[id]/owner: the owners of a business, changed and saved together. */
export default function AdminOwnerScreen({ route }: Props) {
    const { bizId } = route.params;
    const owners = useQuery({ queryKey: adminKeys.owners(bizId), queryFn: () => adminApi.owners(bizId) });
    return (
        <AdminQuery isLoading={owners.isLoading} error={owners.error} onRetry={() => void owners.refetch()} testID="admin-owner">
            {() => <OwnerForm key={owners.dataUpdatedAt} bizId={bizId} bizName={route.params.bizName} saved={owners.data ?? []} />}
        </AdminQuery>
    );
}

function OwnerForm({ bizId, bizName, saved }: { bizId: string; bizName?: string; saved: AdminUserMini[] }) {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [owners, setOwners] = useState<AdminUserMini[]>(saved);
    const [query, setQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const search = useDebouncedValue(query.trim());
    const results = useQuery({
        queryKey: adminKeys.userSearch(search),
        queryFn: () => adminApi.searchUsers(search),
        enabled: search.length >= 2,
    });
    const ownerIds = new Set(owners.map((owner) => owner.id));
    const options = search.length >= 2 ? (results.data ?? []).filter((user) => !ownerIds.has(user.id)) : [];
    const changed = ownersChanged(saved, owners);

    const add = (user: AdminUserMini) => {
        setOwners((current) => (current.some((owner) => owner.id === user.id) ? current : [...current, user]));
        setQuery('');
    };

    const save = async () => {
        if (owners.length === 0) {
            const accepted = await confirm({
                title: t('admin.businesses.owner.title'),
                message: t('admin.app.owner.removeAllConfirm'),
                confirmLabel: t('admin.ownerForm.save'),
                cancelLabel: t('admin.members.cancel'),
                variant: 'danger',
            });
            if (!accepted) return;
        }
        setSaving(true);
        setError(null);
        try {
            await adminApi.saveOwners(bizId, owners.map((owner) => owner.id));
            showToast(owners.length > 0 ? t('admin.ownerForm.updated', { count: owners.length }) : t('admin.ownerForm.allRemoved'), 'success');
            await queryClient.invalidateQueries({ queryKey: adminKeys.business(bizId) });
            await queryClient.invalidateQueries({ queryKey: adminKeys.businesses });
        } catch (cause) {
            setError(adminErrorText(cause, t('admin.app.actionFailed'), t));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Screen
            keyboard
            testID="admin-owner"
            footer={(
                <ActionBar
                    primary={{
                        title: saving ? t('admin.ownerForm.saving') : changed ? t('admin.ownerForm.save') : t('admin.ownerForm.noChanges'),
                        onPress: () => void save(),
                        loading: saving,
                        disabled: !changed,
                        testID: 'admin-owner-save',
                    }}
                />
            )}
        >
            {bizName ? <ScreenIntro>{bizName}</ScreenIntro> : null}
            {error ? <FeedbackBanner variant="danger" message={error} compact /> : null}

            <Section title={t('admin.ownerForm.current', { count: owners.length })}>
                {owners.length === 0 ? (
                    <EmptyState icon="person-outline" compact title={t('admin.businessDetail.owner.empty')} message={t('admin.businessDetail.owner.empty.description')} />
                ) : (
                    <ListGroup>
                        {owners.map((owner) => (
                            <ListRow
                                key={owner.id}
                                leading={<Avatar name={owner.full_name || owner.email || owner.phone} size={40} />}
                                title={owner.full_name || owner.email || owner.phone || owner.id}
                                subtitle={owner.full_name ? userContacts(owner) : undefined}
                                trailing={(
                                    <Button
                                        title={t('admin.ownerForm.remove')}
                                        onPress={() => setOwners((current) => current.filter((item) => item.id !== owner.id))}
                                        variant="ghost"
                                        size="sm"
                                        disabled={saving}
                                        textStyle={adminStyles.dangerText}
                                        accessibilityLabel={`${t('admin.ownerForm.remove')}: ${userLabel(owner)}`}
                                    />
                                )}
                                chevron={false}
                                testID={`admin-owner-${owner.id}`}
                            />
                        ))}
                    </ListGroup>
                )}
            </Section>

            <Section title={t('admin.ownerForm.addLabel')} caption={t('admin.ownerForm.hint')}>
                <Input
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t('admin.ownerForm.addPlaceholder')}
                    accessibilityLabel={t('admin.ownerForm.addLabel')}
                    leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                    autoCapitalize="none"
                    autoCorrect={false}
                    containerStyle={adminStyles.search}
                    testID="admin-owner-search"
                />
                {query.trim().length > 0 && query.trim().length < 2 ? <Text style={adminStyles.caption}>{t('admin.ownerForm.minChars')}</Text> : null}
                {search.length >= 2 && results.isLoading ? <SkeletonList rows={2} /> : null}
                {search.length >= 2 && !results.isLoading && options.length === 0 ? (
                    <EmptyState icon="search-outline" compact title={t('admin.ownerForm.nothingFound')} />
                ) : null}
                {options.length > 0 ? (
                    <ListGroup>
                        {options.map((user) => (
                            <ListRow
                                key={user.id}
                                leading={<Avatar name={user.full_name || user.email || user.phone} size={40} />}
                                title={user.full_name || user.email || user.phone || user.id}
                                subtitle={user.full_name ? userContacts(user) : undefined}
                                trailing={<Ionicons name="add-circle" size={24} color={colors.tone.accent.fg} />}
                                onPress={() => add(user)}
                                accessibilityHint={t('admin.ownerForm.addLabel')}
                                testID={`admin-owner-option-${user.id}`}
                            />
                        ))}
                    </ListGroup>
                ) : null}
            </Section>
        </Screen>
    );
}
