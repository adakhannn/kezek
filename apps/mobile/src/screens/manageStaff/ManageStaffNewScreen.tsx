import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { ensureCurrentBusiness } from '../manage/currentBusiness';
import { createStaffFromUser, searchUsers } from './api';
import { staffErrorMessage } from './errors';
import { staffQueryKeys } from './queryKeys';
import type { FoundUser } from './types';
import { OptionList, SectionTitle, ToggleRow, ui } from './ui';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ManageStaffNew'>;

/**
 * /dashboard/staff/new: invite an existing account to the team (API-06). The card is linked only
 * after the person accepts the invitation in their cabinet.
 */
export default function ManageStaffNewScreen() {
    const navigation = useNavigation<Navigation>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageStaffNew'>>();
    const { t } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<FoundUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [branchId, setBranchId] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [creating, setCreating] = useState(false);
    const [invitation, setInvitation] = useState<'pending' | 'already_staff' | null>(null);

    const branches = useQuery({
        queryKey: [...staffQueryKeys.business(params.bizId), 'branches'],
        queryFn: async () => {
            await ensureCurrentBusiness(params.bizId);
            const { data, error } = await supabase.from('branches').select('id,name').eq('biz_id', params.bizId).order('name');
            // FE-08: a failed read is an error, not "no branches".
            if (error) throw error;
            return (data ?? []) as { id: string; name: string }[];
        },
    });

    useEffect(() => {
        if (!branchId && branches.data?.[0]) setBranchId(branches.data[0].id);
    }, [branches.data, branchId]);

    const doSearch = async () => {
        const normalized = q.trim();
        if (!normalized) {
            setResults([]);
            setSelectedUserId('');
            setHasSearched(false);
            setSearchError(t('manageStaff.staff.new.table.empty.enterQuery'));
            return;
        }
        setLoading(true);
        setSearchError(null);
        setHasSearched(true);
        try {
            setResults(await searchUsers(params.bizId, normalized));
        } catch (error) {
            setResults([]);
            setSearchError(staffErrorMessage(error, t('manageStaff.searchFailed'), t));
        } finally {
            setLoading(false);
        }
    };

    const create = async () => {
        if (!selectedUserId) { showToast(t('manageStaff.staff.new.errors.selectUser'), 'error'); return; }
        if (!branchId) { showToast(t('manageStaff.staff.new.errors.selectBranch'), 'error'); return; }
        setCreating(true);
        try {
            const result = await createStaffFromUser(params.bizId, { userId: selectedUserId, branchId, isActive });
            setInvitation(result.status === 'already_staff' ? 'already_staff' : 'pending');
            await queryClient.invalidateQueries({ queryKey: staffQueryKeys.business(params.bizId) });
        } catch (error) {
            showToast(staffErrorMessage(error, t('manageStaff.staff.new.errors.createFailed'), t), 'error');
        } finally {
            setCreating(false);
        }
    };

    if (branches.isLoading) return <LoadingSpinner message={t('common.loading')} />;
    if (branches.error) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('manageStaff.loadError')}
                message={staffErrorMessage(branches.error, t('staff.checkConnection'), t)}
                action={<Button title={t('staff.retry')} onPress={() => void branches.refetch()} variant="outline" fullWidth />}
            />
        );
    }

    return (
        <ScrollView style={ui.container} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" testID="manage-staff-new">
            <Text style={ui.title} accessibilityRole="header">{t('manageStaff.staff.new.title')}</Text>
            <FeedbackBanner
                variant="warning"
                title={t('manageStaff.staff.new.manualOverride.title')}
                message={t('manageStaff.staff.new.manualOverride.message')}
            />
            {searchError ? <FeedbackBanner variant="danger" message={searchError} /> : null}
            {invitation ? (
                <FeedbackBanner
                    variant="success"
                    message={t(invitation === 'pending' ? 'manageStaff.staff.new.invitation.sent' : 'manageStaff.staff.new.invitation.alreadyInTeam')}
                    action={<Button title={t('manageStaff.staff.new.invitation.toList')} onPress={() => navigation.goBack()} size="sm" />}
                />
            ) : null}

            <Card>
                <SectionTitle title={t('manageStaff.staff.new.search.label')} description={t('manageStaff.staff.new.search.hint')} />
                <Input
                    value={q}
                    onChangeText={setQ}
                    placeholder={t('manageStaff.staff.new.search.placeholder')}
                    accessibilityLabel={t('manageStaff.staff.new.search.label')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={() => void doSearch()}
                    testID="manage-staff-new-query"
                />
                <Button
                    title={t(loading ? 'manageStaff.staff.new.search.searching' : 'manageStaff.staff.new.search.button')}
                    onPress={() => void doSearch()}
                    loading={loading}
                    fullWidth
                />
                <View style={styles.results}>
                    {results.length === 0 ? (
                        <Text style={ui.muted}>
                            {t(hasSearched ? 'manageStaff.staff.new.table.empty.noResults' : 'manageStaff.staff.new.table.empty.enterQuery')}
                        </Text>
                    ) : (
                        <OptionList
                            options={results.map((user) => ({
                                value: user.id,
                                label: user.full_name,
                                hint: [user.email ?? '—', user.phone ?? '—'].join(' · '),
                            }))}
                            value={selectedUserId}
                            onChange={setSelectedUserId}
                            testID="manage-staff-new-results"
                        />
                    )}
                </View>
            </Card>

            <Card>
                <Text style={ui.label}>{t('manageStaff.staff.new.branch.label')}</Text>
                {(branches.data ?? []).length === 0 ? (
                    <Text style={ui.muted}>{t('manageStaff.noBranches')}</Text>
                ) : (
                    <OptionList
                        options={(branches.data ?? []).map((branch) => ({ value: branch.id, label: branch.name }))}
                        value={branchId}
                        onChange={setBranchId}
                        testID="manage-staff-new-branch"
                    />
                )}
                <View style={ui.divider} />
                <ToggleRow label={t('manageStaff.staff.new.active.label')} value={isActive} onChange={setIsActive} />
                <Button
                    title={t('manageStaff.staff.new.create.button')}
                    onPress={() => void create()}
                    loading={creating}
                    fullWidth
                    style={styles.create}
                />
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    results: { marginTop: colors.layout.space3 },
    create: { marginTop: colors.layout.space3 },
});
