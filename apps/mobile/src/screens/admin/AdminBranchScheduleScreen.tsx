import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { RootStackParamList } from '../../navigation/types';
import { scheduleWeek } from '../manage/catalog/branchSchedule';
import { ScheduleEditor } from '../manage/catalog/BranchScheduleScreen';
import { adminApi, adminKeys } from './adminApi';
import { AdminQuery } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminBranchSchedule'>;

/**
 * The working hours of /admin/businesses/[id]/branches/[branchId] (the website's admin
 * BranchScheduleEditor): the cabinet's week editor, saved through the super-admin route.
 */
export default function AdminBranchScheduleScreen({ route }: Props) {
    const { bizId, branchId } = route.params;
    const queryClient = useQueryClient();
    const detail = useQuery({ queryKey: adminKeys.branch(bizId, branchId), queryFn: () => adminApi.branch(bizId, branchId) });
    return (
        <AdminQuery isLoading={detail.isLoading} error={detail.error} onRetry={() => void detail.refetch()} skeleton="form" testID="admin-branch-schedule">
            {() => (
                <ScheduleEditor
                    initial={scheduleWeek(detail.data!.schedule)}
                    save={async (week) => {
                        await adminApi.saveBranchSchedule(bizId, branchId, week);
                        await queryClient.invalidateQueries({ queryKey: adminKeys.branch(bizId, branchId) });
                    }}
                />
            )}
        </AdminQuery>
    );
}
