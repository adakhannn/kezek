import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ActionBar from '../../components/ui/ActionBar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ErrorState from '../../components/ui/ErrorState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { colors } from '../../constants/colors';
import { space } from '../../constants/theme';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { ensureCurrentBusiness } from '../manage/currentBusiness';
import { createStaffFromUser, searchUsers } from './api';
import { staffErrorMessage } from './errors';
import { staffQueryKeys } from './queryKeys';
import type { FoundUser } from './types';
import { OptionList, ToggleRow, ui } from './ui';

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

    if (branches.isLoading) {
        return (
            <Screen>
                <SkeletonCard lines={2} />
                <SkeletonCard lines={3} />
            </Screen>
        );
    }
    if (branches.error) {
        return (
            <Screen>
                <ErrorState
                    title={t('manageStaff.loadError')}
                    message={staffErrorMessage(branches.error, t('staff.checkConnection'), t)}
                    onRetry={() => void branches.refetch()}
                />
            </Screen>
        );
    }

    return (
        <Screen
            keyboard
            testID="manage-staff-new"
            footer={(
                <ActionBar
                    primary={{
                        title: t('manageStaff.staff.new.create.button'),
                        onPress: () => void create(),
                        loading: creating,
                        testID: 'manage-staff-new-create',
                    }}
                />
            )}
        >
            {/* The header says "Добавить сотрудника": one muted line names the business. */}
            {params.bizName ? <ScreenIntro>{params.bizName}</ScreenIntro> : null}
            <FeedbackBanner
                variant="info"
                title={t('manageStaff.staff.new.manualOverride.title')}
                message={t('manageStaff.staff.new.manualOverride.message')}
                compact
            />
            {invitation ? (
                <FeedbackBanner
                    variant="success"
                    message={t(invitation === 'pending' ? 'manageStaff.staff.new.invitation.sent' : 'manageStaff.staff.new.invitation.alreadyInTeam')}
                    action={<Button title={t('manageStaff.staff.new.invitation.toList')} onPress={() => navigation.goBack()} size="sm" variant="outline" />}
                />
            ) : null}

            <Section title={t('manageStaff.staff.new.search.label')} caption={t('manageStaff.staff.new.search.hint')}>
                <View style={styles.searchRow}>
                    <Input
                        value={q}
                        onChangeText={setQ}
                        placeholder={t('manageStaff.staff.new.search.placeholder')}
                        accessibilityLabel={t('manageStaff.staff.new.search.label')}
                        leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        onSubmitEditing={() => void doSearch()}
                        containerStyle={styles.searchInput}
                        testID="manage-staff-new-query"
                    />
                    <Button
                        title={t(loading ? 'manageStaff.staff.new.search.searching' : 'manageStaff.staff.new.search.button')}
                        onPress={() => void doSearch()}
                        loading={loading}
                        variant="secondary"
                        style={styles.searchButton}
                    />
                </View>
                {searchError ? <FeedbackBanner variant="danger" message={searchError} compact /> : null}
                {results.length === 0 ? (
                    <Text style={ui.muted}>
                        {t(hasSearched ? 'manageStaff.staff.new.table.empty.noResults' : 'manageStaff.staff.new.table.empty.enterQuery')}
                    </Text>
                ) : (
                    <OptionList
                        card
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
            </Section>

            <Section title={t('manageStaff.staff.new.branch.label')}>
                {(branches.data ?? []).length === 0 ? (
                    <Text style={ui.muted}>{t('manageStaff.noBranches')}</Text>
                ) : (
                    <OptionList
                        card
                        options={(branches.data ?? []).map((branch) => ({ value: branch.id, label: branch.name }))}
                        value={branchId}
                        onChange={setBranchId}
                        testID="manage-staff-new-branch"
                    />
                )}
            </Section>

            <Card variant="plain" padding="md" style={styles.switchCard}>
                <ToggleRow label={t('manageStaff.staff.new.active.label')} value={isActive} onChange={setIsActive} />
            </Card>
        </Screen>
    );
}

const styles = StyleSheet.create({
    searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
    searchInput: { flex: 1, width: undefined, marginBottom: 0 },
    searchButton: { minWidth: 88 },
    switchCard: { paddingVertical: space.xs },
});
