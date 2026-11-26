import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { adminApi, adminKeys, canManageMembers, type AdminMember, type MemberRoleKey } from './adminApi';
import { availableRoles, isMemberRole, MEMBER_ROLE_LABELS, userContacts } from './adminLogic';
import { AdminQuery, adminErrorText, adminStyles } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminMembers'>;

const ROLE_TONES: Record<MemberRoleKey, 'accent' | 'danger' | 'info' | 'success' | 'neutral'> = {
    owner: 'accent',
    admin: 'danger',
    manager: 'info',
    staff: 'success',
    client: 'neutral',
};

/**
 * The website's /admin/businesses/[id]/members: the business's accounts and their roles. As on the
 * website, roles are granted and revoked by the owner or an admin of that business; others view.
 */
export default function AdminMembersScreen({ navigation, route }: Props) {
    const { bizId, bizName } = route.params;
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const members = useQuery({ queryKey: adminKeys.members(bizId), queryFn: () => adminApi.members(bizId) });
    const access = useQuery({ queryKey: adminKeys.canManageMembers(bizId), queryFn: () => canManageMembers(bizId) });
    const canManage = access.data === true;

    const refresh = async () => {
        setRefreshing(true);
        try { await Promise.all([members.refetch(), access.refetch()]); } finally { setRefreshing(false); }
    };

    const run = async (key: string, action: () => Promise<unknown>) => {
        setBusy(key);
        try {
            await action();
            await queryClient.invalidateQueries({ queryKey: adminKeys.business(bizId) });
        } catch (error) {
            showToast(adminErrorText(error, t('admin.app.actionFailed'), t), 'error');
        } finally {
            setBusy(null);
        }
    };

    const revoke = async (member: AdminMember, role: MemberRoleKey) => {
        const accepted = await confirm({
            title: t('admin.members.removeRole'),
            message: t('admin.app.members.revokeConfirm', { role: t(MEMBER_ROLE_LABELS[role]), name: member.full_name || member.email || member.phone || member.user_id }),
            confirmLabel: t('admin.members.removeRole'),
            cancelLabel: t('admin.members.cancel'),
            variant: 'danger',
        });
        if (accepted) await run(`${member.user_id}-revoke-${role}`, () => adminApi.revokeRole(bizId, member.user_id, role));
    };

    const demote = async (member: AdminMember) => {
        const accepted = await confirm({
            title: t('admin.members.demoteTitle'),
            message: t('admin.members.demoteMessage'),
            confirmLabel: t('admin.members.demoteConfirm'),
            cancelLabel: t('admin.members.cancel'),
            variant: 'danger',
        });
        if (accepted) await run(`${member.user_id}-demote`, () => adminApi.demoteMember(bizId, member.user_id));
    };

    return (
        <AdminQuery isLoading={members.isLoading} error={members.error} onRetry={() => void members.refetch()} testID="admin-members">
            {() => {
                const items = members.data ?? [];
                return (
                    <Screen refreshing={refreshing} onRefresh={refresh} testID="admin-members">
                        {bizName ? <ScreenIntro>{bizName}</ScreenIntro> : null}
                        <Button
                            title={t('admin.membersPage.addMember')}
                            onPress={() => navigation.navigate('AdminMemberNew', { bizId, bizName })}
                            leadingIcon={<Ionicons name="person-add" size={18} color={colors.text.light} />}
                            fullWidth
                            testID="admin-members-add"
                        />
                        {!canManage && !access.isLoading ? <Text style={adminStyles.caption}>{t('admin.app.members.viewOnly')}</Text> : null}
                        <Section>
                            {items.length === 0 ? (
                                <EmptyState icon="people-outline" compact title={t('admin.members.emptyTitle')} message={t('admin.members.emptyDescription')} />
                            ) : (
                                <View style={adminStyles.list}>
                                    {items.map((member) => {
                                        const name = member.full_name || t('admin.members.noName');
                                        const rowBusy = busy?.startsWith(`${member.user_id}-`) ?? false;
                                        const missing = availableRoles(member.roles);
                                        return (
                                            <View key={member.user_id} style={adminStyles.itemPadded} testID={`admin-member-${member.user_id}`}>
                                                <ListRow
                                                    leading={<Avatar name={name} size={44} />}
                                                    title={name}
                                                    subtitle={userContacts(member) ?? member.user_id}
                                                    onPress={() => navigation.navigate('AdminUser', { userId: member.user_id, userName: member.full_name ?? undefined })}
                                                    style={styles.person}
                                                />
                                                <View style={styles.block}>
                                                    <Text style={styles.overline}>{t('admin.members.roles')}</Text>
                                                    <View style={adminStyles.badges}>
                                                        {member.roles.length === 0 ? <Text style={adminStyles.caption}>{t('admin.members.noRoles')}</Text> : null}
                                                        {member.roles.map((role) => {
                                                            const known = isMemberRole(role);
                                                            const label = known ? t(MEMBER_ROLE_LABELS[role]) : role;
                                                            if (!canManage || !known) return <Badge key={role} label={label} tone={known ? ROLE_TONES[role] : 'neutral'} size="md" />;
                                                            return (
                                                                <Pressable
                                                                    key={role}
                                                                    onPress={() => void revoke(member, role)}
                                                                    disabled={rowBusy}
                                                                    accessibilityRole="button"
                                                                    accessibilityLabel={`${t('admin.members.removeRole')}: ${label}`}
                                                                    style={({ pressed }) => [styles.roleChip, pressed ? styles.pressed : null]}
                                                                >
                                                                    <Text style={styles.roleChipText}>{label}</Text>
                                                                    <Ionicons name="close" size={14} color={colors.text.secondary} />
                                                                </Pressable>
                                                            );
                                                        })}
                                                    </View>
                                                </View>
                                                {canManage && missing.length > 0 ? (
                                                    <View style={styles.block}>
                                                        <Text style={styles.overline}>{t('admin.members.addRole')}</Text>
                                                        <View style={adminStyles.badges}>
                                                            {missing.map((role) => (
                                                                <Pressable
                                                                    key={role}
                                                                    onPress={() => void run(`${member.user_id}-grant-${role}`, () => adminApi.grantRole(bizId, member.user_id, role))}
                                                                    disabled={rowBusy}
                                                                    accessibilityRole="button"
                                                                    accessibilityLabel={`${t('admin.members.addRole')}: ${t(MEMBER_ROLE_LABELS[role])}`}
                                                                    style={({ pressed }) => [styles.addChip, pressed ? styles.pressed : null]}
                                                                >
                                                                    <Ionicons name="add" size={14} color={colors.tone.accent.fg} />
                                                                    <Text style={styles.addChipText}>{t(MEMBER_ROLE_LABELS[role])}</Text>
                                                                </Pressable>
                                                            ))}
                                                        </View>
                                                    </View>
                                                ) : null}
                                                {canManage ? (
                                                    <View style={adminStyles.actionsPadded}>
                                                        <Button
                                                            title={busy === `${member.user_id}-demote` ? t('admin.members.processing') : t('admin.members.demote')}
                                                            onPress={() => void demote(member)}
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={rowBusy}
                                                            textStyle={adminStyles.dangerText}
                                                        />
                                                    </View>
                                                ) : null}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </Section>
                    </Screen>
                );
            }}
        </AdminQuery>
    );
}

const styles = StyleSheet.create({
    person: { paddingHorizontal: 0, paddingVertical: 0 },
    block: { gap: space.sm },
    overline: { ...typeScale.overline, color: colors.text.tertiary },
    roleChip: {
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.md,
        borderRadius: radii.pill,
        backgroundColor: colors.tone.accent.bg,
    },
    roleChipText: { ...typeScale.callout, fontWeight: '600', color: colors.tone.accent.fg },
    addChip: {
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.md,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    addChipText: { ...typeScale.callout, color: colors.text.secondary },
    pressed: { opacity: colors.interactive.pressedOpacity },
});
