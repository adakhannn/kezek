import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { fetchScheduleContext } from './api';
import { staffErrorMessage } from './errors';
import { ExplicitScheduleEditor } from './ExplicitScheduleEditor';
import { LegacyScheduleEditor } from './LegacyScheduleEditor';
import { staffQueryKeys } from './queryKeys';
import { ui } from './ui';

/**
 * /dashboard/staff/[id]/schedule. The server decides the editor, as on the website: explicit
 * scheduling (published versions and absences) when SCHEDULE_V2_ENABLED is on, otherwise the
 * legacy day rules; a staff member already on published versions gets an explanation instead.
 */
export default function ManageStaffScheduleScreen() {
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageStaffSchedule'>>();
    const { t } = useLanguage();
    const tz = resolveBusinessTimeZone(params.tz);
    const context = useQuery({
        queryKey: staffQueryKeys.schedule(params.bizId, params.staffId),
        queryFn: () => fetchScheduleContext(params.bizId, params.staffId),
    });

    if (context.isLoading) return <LoadingSpinner message={t('common.loading')} />;
    if (!context.data) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('manageStaff.loadError')}
                message={staffErrorMessage(context.error, t('staff.checkConnection'), t)}
                action={<Button title={t('staff.retry')} onPress={() => void context.refetch()} variant="outline" fullWidth />}
            />
        );
    }

    const { staff, branches, explicitScheduling, legacy, business } = context.data;
    let editor;
    if (legacy?.failed) {
        editor = <FeedbackBanner variant="danger" message={t('manageStaff.loadError')} action={<Button title={t('staff.retry')} onPress={() => void context.refetch()} size="sm" variant="outline" />} />;
    } else if (explicitScheduling || !legacy) {
        editor = <ExplicitScheduleEditor key={context.dataUpdatedAt} bizId={params.bizId} staffId={staff.id} branches={branches} homeBranchId={staff.branch_id} />;
    } else if (legacy.usesPublishedSchedule) {
        editor = (
            <FeedbackBanner
                variant="info"
                title={t('manageStaff.staff.schedule.publishedModel.title')}
                message={t('manageStaff.staff.schedule.publishedModel.text')}
            />
        );
    } else {
        editor = (
            <LegacyScheduleEditor
                key={context.dataUpdatedAt}
                bizId={params.bizId}
                staffId={staff.id}
                branches={branches}
                homeBranchId={staff.branch_id}
                tz={tz}
                branchHours={legacy.branchHours}
                hasRegularSchedule={legacy.hasRegularSchedule}
            />
        );
    }

    return (
        <ScrollView
            style={ui.container}
            contentContainerStyle={ui.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={context.isRefetching} onRefresh={() => void context.refetch()} />}
            testID="manage-staff-schedule"
        >
            <View>
                <Text style={ui.title} accessibilityRole="header">{t('manageStaff.staff.schedule.title')}</Text>
                <Text style={ui.subtitle}>{staff.full_name}</Text>
                <Text style={ui.muted}>
                    {t('manageStaff.staff.schedule.biz.context')}: {business.name || params.bizName || t('manageStaff.staff.schedule.biz.defaultName')}
                    {business.city ? ` · ${business.city}` : ''}
                </Text>
            </View>
            {editor}
        </ScrollView>
    );
}
