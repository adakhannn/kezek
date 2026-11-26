import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import ErrorState from '../../components/ui/ErrorState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { fetchScheduleContext } from './api';
import { staffErrorMessage } from './errors';
import { ExplicitScheduleEditor } from './ExplicitScheduleEditor';
import { LegacyScheduleEditor } from './LegacyScheduleEditor';
import { staffQueryKeys } from './queryKeys';

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

    if (context.isLoading) {
        return (
            <Screen>
                <SkeletonCard lines={2} />
                <SkeletonCard lines={4} />
            </Screen>
        );
    }
    if (!context.data) {
        return (
            <Screen>
                <ErrorState
                    title={t('manageStaff.loadError')}
                    message={staffErrorMessage(context.error, t('staff.checkConnection'), t)}
                    onRetry={() => void context.refetch()}
                />
            </Screen>
        );
    }

    const { staff, branches, explicitScheduling, legacy, business } = context.data;
    let editor;
    if (legacy?.failed) {
        editor = <ErrorState compact title={t('manageStaff.loadError')} onRetry={() => void context.refetch()} />;
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

    const intro = [staff.full_name, business.name || params.bizName || t('manageStaff.staff.schedule.biz.defaultName'), business.city]
        .filter(Boolean)
        .join(' · ');

    return (
        <Screen
            keyboard
            refreshing={context.isRefetching}
            onRefresh={() => void context.refetch()}
            testID="manage-staff-schedule"
        >
            {/* The header says "Расписание": one muted line with the person and the business. */}
            <ScreenIntro>{intro}</ScreenIntro>
            {editor}
        </Screen>
    );
}
