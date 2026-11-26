import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField from '../../components/ui/FormField';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import { space, typeScale } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { formatDateTime } from '../../utils/format';
import { adminApi, adminKeys, type AdminUserDetail } from './adminApi';
import { isE164OrEmpty, isEmailOrEmpty, isMemberRole, MEMBER_ROLE_LABELS } from './adminLogic';
import { AdminQuery, adminErrorText, adminStyles } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminUser'>;

/** The website's /admin/users/[id]: the account, its businesses and roles, and the security actions. */
export default function AdminUserScreen({ navigation, route }: Props) {
    const { userId } = route.params;
    const detail = useQuery({ queryKey: adminKeys.user(userId), queryFn: () => adminApi.user(userId) });
    return (
        <AdminQuery isLoading={detail.isLoading} error={detail.error} onRetry={() => void detail.refetch()} skeleton="hub" testID="admin-user">
            {() => <UserCard key={detail.dataUpdatedAt} data={detail.data!} refetch={detail.refetch} navigation={navigation} />}
        </AdminQuery>
    );
}

function UserCard({ data, refetch, navigation }: { data: AdminUserDetail; refetch: () => Promise<unknown>; navigation: Props['navigation'] }) {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const { user, ownerBusinesses, roles, suspension } = data;
    const [fullName, setFullName] = useState(user.full_name ?? '');
    const [email, setEmail] = useState(user.email ?? '');
    const [phone, setPhone] = useState(user.phone ?? '');
    const [formError, setFormError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [magicLink, setMagicLink] = useState<string | null>(null);
    const name = user.full_name || user.email || t('admin.users.user');
    const changed = fullName !== (user.full_name ?? '') || email !== (user.email ?? '') || phone !== (user.phone ?? '');

    const refresh = async () => {
        setRefreshing(true);
        try { await refetch(); } finally { setRefreshing(false); }
    };

    const reload = async () => {
        await queryClient.invalidateQueries({ queryKey: adminKeys.user(user.id) });
        await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        await queryClient.invalidateQueries({ queryKey: adminKeys.userStats });
    };

    const run = async (key: string, action: () => Promise<string | null>) => {
        setBusy(key);
        try {
            const message = await action();
            if (message) showToast(message, 'success');
        } catch (error) {
            showToast(adminErrorText(error, t('admin.app.actionFailed'), t), 'error');
        } finally {
            setBusy(null);
        }
    };

    const saveBasic = async () => {
        setFormError(null);
        if (!isEmailOrEmpty(email)) { setFormError(t('admin.userBasic.emailInvalid')); return; }
        if (!isE164OrEmpty(phone)) { setFormError(t('admin.userBasic.phoneInvalid')); return; }
        await run('basic', async () => {
            await adminApi.updateUser(user.id, { full_name: fullName.trim(), email: email.trim() || null, phone: phone.trim() || null });
            await reload();
            return t('admin.userBasic.saved');
        });
    };

    const sendMagic = () => run('magic', async () => {
        const link = await adminApi.sendMagicLink(user.id);
        setMagicLink(link);
        return t('admin.userSecurity.magicSent');
    });

    const toggleSuper = async (next: boolean) => {
        const accepted = await confirm({
            title: t('admin.userSecurity.superAdmin'),
            message: t(next ? 'admin.app.users.grantSuperConfirm' : 'admin.app.users.revokeSuperConfirm', { name }),
            confirmLabel: t(next ? 'admin.app.users.grantSuper' : 'admin.app.users.revokeSuper'),
            cancelLabel: t('admin.members.cancel'),
            variant: next ? 'default' : 'danger',
        });
        if (!accepted) return;
        await run('super', async () => {
            const result = await adminApi.toggleSuper(user.id, next);
            if (typeof result?.isSuperAdmin !== 'boolean') throw new Error(t('admin.userSecurity.roleUnconfirmed'));
            await reload();
            return t(result.isSuperAdmin ? 'admin.userSecurity.superGranted' : 'admin.userSecurity.superRevoked');
        });
    };

    const setBlocked = async (block: boolean) => {
        if (block) {
            const accepted = await confirm({
                title: t('admin.userSecurity.block'),
                message: t('admin.app.users.blockConfirm', { name }),
                confirmLabel: t('admin.userSecurity.block'),
                cancelLabel: t('admin.members.cancel'),
                variant: 'danger',
            });
            if (!accepted) return;
        }
        await run('block', async () => {
            const blocked = await adminApi.setBlocked(user.id, block);
            if (blocked !== block) throw new Error(t('admin.userSecurity.blockUnconfirmed'));
            await reload();
            return t(blocked ? 'admin.userSecurity.userBlocked' : 'admin.userSecurity.userUnblocked');
        });
    };

    const remove = async () => {
        const accepted = await confirm({
            title: t('admin.userSecurity.deleteUser'),
            message: t('admin.userSecurity.confirmDelete'),
            confirmLabel: t('admin.userSecurity.delete'),
            cancelLabel: t('admin.members.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setBusy('delete');
        try {
            await adminApi.deleteUser(user.id);
            await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            await queryClient.invalidateQueries({ queryKey: adminKeys.userStats });
            showToast(t('admin.app.users.deleted'), 'success');
            navigation.goBack();
        } catch (error) {
            showToast(adminErrorText(error, t('admin.userSecurity.deleteUnconfirmed'), t), 'error');
            setBusy(null);
        }
    };

    return (
        <Screen refreshing={refreshing} onRefresh={refresh} keyboard testID="admin-user">
            <Card variant="accent" padding="md" style={styles.hero}>
                <Avatar name={name} size={56} />
                <View style={styles.heroText}>
                    <Text style={styles.heroName} accessibilityRole="header" numberOfLines={2}>{name}</Text>
                    <View style={adminStyles.badges}>
                        {data.isSuper ? <Badge label={t('admin.users.superAdmin')} tone="accent" icon="shield-checkmark-outline" /> : null}
                        {suspension ? <Badge label={t('admin.users.blocked')} tone="danger" icon="ban-outline" /> : null}
                    </View>
                    {user.last_sign_in_at ? (
                        <Text style={adminStyles.caption}>{t('admin.users.lastSignIn')}: {formatDateTime(user.last_sign_in_at, true, t.locale)}</Text>
                    ) : null}
                </View>
            </Card>

            {suspension ? (
                <FeedbackBanner
                    variant="danger"
                    title={t('admin.users.blocked.title')}
                    message={[
                        suspension.reason ? `${t('admin.users.blocked.reason')}: ${suspension.reason}` : null,
                        suspension.created_at ? `${t('admin.users.blocked.date')}: ${formatDateTime(suspension.created_at, true, t.locale)}` : null,
                    ].filter(Boolean).join(' • ') || t('admin.users.blocked.title')}
                />
            ) : null}

            <Section title={t('admin.userBasic.title')}>
                <Card variant="plain" padding="md">
                    {formError ? <FeedbackBanner variant="danger" message={formError} compact style={styles.formError} /> : null}
                    <FormField label={t('admin.userBasic.nameLabel')} placeholder={t('admin.userBasic.namePlaceholder')} value={fullName} onChangeText={setFullName} testID="admin-user-name" />
                    <FormField label={t('admin.userBasic.emailLabel')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} testID="admin-user-email" />
                    <FormField label={t('admin.userBasic.phoneLabel')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" hint={t('admin.userBasic.phoneHelper')} placeholder="+996XXXXXXXXX" testID="admin-user-phone" />
                    <Button
                        title={busy === 'basic' ? t('admin.userBasic.saving') : changed ? t('admin.userBasic.save') : t('admin.userBasic.noChanges')}
                        onPress={() => void saveBasic()}
                        loading={busy === 'basic'}
                        disabled={!changed || !!busy}
                        fullWidth
                        testID="admin-user-save"
                    />
                </Card>
            </Section>

            <Section title={t('admin.users.businessOwner')}>
                {ownerBusinesses.length === 0 ? (
                    <EmptyState icon="storefront-outline" compact title={t('admin.users.noBusinessOwner')} />
                ) : (
                    <ListGroup inset>
                        {ownerBusinesses.map((business) => (
                            <ListRow
                                key={business.id}
                                icon="storefront-outline"
                                title={business.name}
                                subtitle={business.slug ? `@${business.slug}` : undefined}
                                onPress={() => navigation.navigate('AdminBusiness', { bizId: business.id, bizName: business.name })}
                            />
                        ))}
                    </ListGroup>
                )}
            </Section>

            <Section title={t('admin.users.roles.title')} caption={t('admin.users.roles.hint')}>
                {roles.length === 0 ? (
                    <Text style={adminStyles.caption}>{t('admin.users.roles.empty')}</Text>
                ) : (
                    <ListGroup inset>
                        {roles.map((role, index) => (
                            <ListRow
                                key={`${role.role_key}:${role.biz_id ?? 'global'}:${index}`}
                                icon="key-outline"
                                iconTone="neutral"
                                title={isMemberRole(role.role_key) ? t(MEMBER_ROLE_LABELS[role.role_key]) : role.role_key}
                                subtitle={role.biz_id ? role.biz_name ?? role.biz_id : t('admin.users.role.global')}
                                onPress={role.biz_id ? () => navigation.navigate('AdminBusiness', { bizId: role.biz_id!, bizName: role.biz_name ?? undefined }) : undefined}
                                chevron={!!role.biz_id}
                            />
                        ))}
                    </ListGroup>
                )}
            </Section>

            <Section title={t('admin.userSecurity.title')}>
                <ListGroup inset>
                    <ListRow
                        icon="mail-outline"
                        title={busy === 'magic' ? t('admin.userSecurity.sending') : t('admin.userSecurity.sendMagic')}
                        onPress={() => void sendMagic()}
                        disabled={!!busy}
                        chevron={false}
                        testID="admin-user-magic"
                    />
                    <ListRow
                        icon="shield-checkmark-outline"
                        iconTone="info"
                        title={t('admin.userSecurity.superAdmin')}
                        switchValue={data.isSuper}
                        onSwitchChange={(next) => void toggleSuper(next)}
                        disabled={!!busy}
                        testID="admin-user-super"
                    />
                    <ListRow
                        icon={suspension ? 'lock-open-outline' : 'ban-outline'}
                        iconTone={suspension ? 'success' : 'warning'}
                        title={t(suspension ? 'admin.userSecurity.unblock' : 'admin.userSecurity.block')}
                        subtitle={`${t('admin.userSecurity.blockStatus')}: ${t(suspension ? 'admin.users.blocked' : 'admin.userSecurity.active')}`}
                        onPress={() => void setBlocked(!suspension)}
                        disabled={!!busy}
                        chevron={false}
                        testID="admin-user-block"
                    />
                </ListGroup>
                {magicLink ? (
                    <Card variant="muted" padding="md" style={styles.magic}>
                        <Text style={adminStyles.caption}>{t('admin.userSecurity.signInLink')}</Text>
                        <Text style={styles.link} selectable numberOfLines={3}>{magicLink}</Text>
                        <Button title={t('admin.app.share')} onPress={() => void Share.share({ message: magicLink })} variant="outline" size="sm" />
                    </Card>
                ) : null}
            </Section>

            <Section title={t('admin.userSecurity.dangerZone')} caption={t('admin.userSecurity.dangerText')}>
                <ListGroup>
                    <ListRow
                        icon="trash-outline"
                        destructive
                        title={busy === 'delete' ? t('admin.userSecurity.deleting') : t('admin.userSecurity.deleteUser')}
                        onPress={() => void remove()}
                        disabled={!!busy}
                        chevron={false}
                        testID="admin-user-delete"
                    />
                </ListGroup>
            </Section>
        </Screen>
    );
}

const styles = StyleSheet.create({
    hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    heroText: { flex: 1, minWidth: 0, gap: space.xs },
    heroName: { ...typeScale.title, color: colors.text.primary },
    formError: { marginBottom: space.md },
    magic: { gap: space.sm },
    link: { ...typeScale.caption, color: colors.tone.accent.fg },
});
