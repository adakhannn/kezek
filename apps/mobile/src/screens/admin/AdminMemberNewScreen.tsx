import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import ChipGroup from '../../components/ui/ChipGroup';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { SkeletonList } from '../../components/ui/Skeleton';
import { colors } from '../../constants/colors';
import { space } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { adminApi, adminKeys } from './adminApi';
import { ELEVATED_ROLES, MEMBER_ROLE_LABELS, userContacts } from './adminLogic';
import { adminErrorText, adminStyles, useDebouncedValue } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminMemberNew'>;

/** The website's /admin/businesses/[id]/members/new: find an account and give it a role in the business. */
export default function AdminMemberNewScreen({ route }: Props) {
    const { bizId } = route.params;
    const { t } = useLanguage();
    const queryClient = useQueryClient();
    const [query, setQuery] = useState('');
    const [role, setRole] = useState<(typeof ELEVATED_ROLES)[number]>('staff');
    const [granting, setGranting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const search = useDebouncedValue(query.trim());
    const results = useQuery({ queryKey: adminKeys.userSearch(search), queryFn: () => adminApi.searchUsers(search) });

    const grant = async (userId: string) => {
        setGranting(userId);
        setError(null);
        setSuccess(null);
        try {
            await adminApi.grantRole(bizId, userId, role);
            await queryClient.invalidateQueries({ queryKey: adminKeys.business(bizId) });
            setSuccess(t('admin.newMember.granted', { role: t(MEMBER_ROLE_LABELS[role]) }));
        } catch (cause) {
            setError(adminErrorText(cause, t('admin.app.actionFailed'), t));
        } finally {
            setGranting(null);
        }
    };

    const items = results.data ?? [];

    return (
        <Screen keyboard testID="admin-member-new">
            <FeedbackBanner variant="warning" title={t('admin.newMember.manualTitle')} message={t('admin.newMember.manualMessage')} />
            <Section title={t('admin.newMember.role')} gap={space.sm}>
                <ChipGroup
                    options={ELEVATED_ROLES.map((key) => ({ key, label: t(MEMBER_ROLE_LABELS[key]) }))}
                    value={role}
                    onChange={setRole}
                    accessibilityLabel={t('admin.newMember.role')}
                    testID="admin-member-role"
                />
            </Section>
            <Section title={t('admin.newMember.searchLabel')} caption={t('admin.newMember.searchHelper')}>
                <Input
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t('admin.newMember.searchPlaceholder')}
                    accessibilityLabel={t('admin.newMember.searchLabel')}
                    leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                    autoCapitalize="none"
                    autoCorrect={false}
                    containerStyle={adminStyles.search}
                    testID="admin-member-search"
                />
                {error ? <FeedbackBanner variant="danger" message={error} compact /> : null}
                {success ? <FeedbackBanner variant="success" message={success} compact /> : null}
                {results.isLoading ? <SkeletonList rows={3} /> : results.error ? (
                    <ErrorState compact onRetry={() => void results.refetch()} />
                ) : items.length === 0 ? (
                    <EmptyState
                        icon="search-outline"
                        compact
                        title={t('admin.newMember.nothingFound')}
                        message={t(search ? 'admin.newMember.changeQuery' : 'admin.newMember.startTyping')}
                    />
                ) : (
                    <View style={adminStyles.list}>
                        {items.map((user) => {
                            const name = user.full_name || t('admin.members.noName');
                            return (
                                <View key={user.id} style={adminStyles.item}>
                                    <ListRow
                                        leading={<Avatar name={name} size={40} />}
                                        title={name}
                                        subtitle={userContacts(user) ?? user.id}
                                        chevron={false}
                                    />
                                    <View style={adminStyles.actions}>
                                        <Button
                                            title={granting === user.id ? t('admin.newMember.granting') : `${t('admin.newMember.grant')} · ${t(MEMBER_ROLE_LABELS[role])}`}
                                            onPress={() => void grant(user.id)}
                                            loading={granting === user.id}
                                            disabled={!!granting}
                                            variant="ghost"
                                            size="sm"
                                            textStyle={adminStyles.accentText}
                                            testID={`admin-member-grant-${user.id}`}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </Section>
        </Screen>
    );
}
