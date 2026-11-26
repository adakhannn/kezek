import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ActionBar from '../../components/ui/ActionBar';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField, { FieldGroup } from '../../components/ui/FormField';
import { KeyValueRow } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { adminApi, adminKeys, type AdminRole } from './adminApi';
import { isValidRoleKey } from './adminLogic';
import { AdminQuery, adminErrorText } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminRoleEdit'>;

/** The website's /admin/roles/new and /admin/roles/[id]: a role's name and description (its key is fixed once created). */
export default function AdminRoleEditScreen({ navigation, route }: Props) {
    const { roleId } = route.params ?? {};
    const { t } = useLanguage();
    const roles = useQuery({ queryKey: adminKeys.roles, queryFn: adminApi.roles, enabled: !!roleId });
    if (!roleId) return <RoleForm onDone={() => navigation.goBack()} />;
    return (
        <AdminQuery isLoading={roles.isLoading} error={roles.error} onRetry={() => void roles.refetch()} skeleton="form" testID="admin-role-edit">
            {() => {
                const role = (roles.data ?? []).find((item) => item.id === roleId);
                if (!role) {
                    return (
                        <Screen>
                            <EmptyState icon="key-outline" title={t('admin.roles.notFound')} />
                        </Screen>
                    );
                }
                return <RoleForm key={role.id} role={role} onDone={() => navigation.goBack()} />;
            }}
        </AdminQuery>
    );
}

function RoleForm({ role, onDone }: { role?: AdminRole; onDone: () => void }) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [name, setName] = useState(role?.name ?? '');
    const [key, setKey] = useState(role?.key ?? '');
    const [description, setDescription] = useState(role?.description ?? '');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setError(null);
        if (!name.trim()) { setError(t('admin.roles.form.nameRequired')); return; }
        if (!role && !isValidRoleKey(key)) { setError(t('admin.roles.form.keyInvalid')); return; }
        setSaving(true);
        try {
            if (role) await adminApi.updateRole(role.id, { name: name.trim(), description: description.trim() || null });
            else await adminApi.createRole({ key: key.trim(), name: name.trim(), description: description.trim() || null });
            await queryClient.invalidateQueries({ queryKey: adminKeys.roles });
            showToast(t(role ? 'admin.roles.form.saved' : 'admin.app.saved'), 'success');
            onDone();
        } catch (cause) {
            setError(adminErrorText(cause, t('admin.app.actionFailed'), t));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Screen
            keyboard
            testID="admin-role-edit"
            footer={(
                <ActionBar
                    primary={{
                        title: role
                            ? (saving ? t('admin.roles.form.saving') : t('admin.roles.form.save'))
                            : (saving ? t('admin.roles.form.creating') : t('admin.roles.form.create')),
                        onPress: () => void save(),
                        loading: saving,
                        testID: 'admin-role-save',
                    }}
                />
            )}
        >
            {error ? <FeedbackBanner variant="danger" message={error} compact /> : null}
            {role ? (
                <Card variant="plain" padding="md">
                    <KeyValueRow label={t('admin.roles.form.systemKey')} value={role.key} />
                    <KeyValueRow label={t('admin.roles.col.kind')} value={t(role.is_system ? 'admin.roles.system' : 'admin.roles.custom')} />
                </Card>
            ) : null}
            <FieldGroup title={t(role ? 'admin.roles.form.paramsTitle' : 'admin.roles.form.dataTitle')}>
                <FormField
                    label={t('admin.app.roles.name')}
                    required
                    value={name}
                    onChangeText={setName}
                    placeholder={t('admin.roles.form.namePlaceholder')}
                    testID="admin-role-name"
                />
                {!role ? (
                    <FormField
                        label={t('admin.app.roles.key')}
                        required
                        value={key}
                        onChangeText={(next) => setKey(next.toLowerCase())}
                        placeholder={t('admin.roles.form.keyPlaceholder')}
                        hint={t('admin.roles.form.keyHelper')}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={32}
                        testID="admin-role-key"
                    />
                ) : null}
                <FormField
                    label={t('admin.roles.form.description')}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t('admin.roles.form.descriptionPlaceholder')}
                    multiline
                    testID="admin-role-description"
                />
            </FieldGroup>
        </Screen>
    );
}
