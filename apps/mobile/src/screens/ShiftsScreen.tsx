import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Screen from '../components/ui/Screen';
import { SkeletonBlock, SkeletonCard } from '../components/ui/Skeleton';
import { StatGrid } from '../components/ui/StatTile';
import { useLanguage } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { ShiftsScreenSections } from './shifts/ShiftsScreenSections';
import { useShiftsScreenData } from './shifts/useShiftsScreenData';

type ShiftsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Shifts'>;

export default function ShiftsScreen() {
    const navigation = useNavigation<ShiftsScreenNavigationProp>();
    const { t } = useLanguage();
    const {
        period,
        setPeriod,
        refreshing,
        staffInfo,
        staffLoading,
        needsSelection,
        stats,
        statsLoading,
        statsError,
        onRefresh,
    } = useShiftsScreenData();

    if (staffLoading || (statsLoading && !refreshing)) {
        return (
            <Screen testID="shifts-loading">
                <SkeletonBlock height={44} />
                <SkeletonBlock height={84} radius={16} />
                <StatGrid>
                    <SkeletonBlock height={84} radius={16} />
                    <SkeletonBlock height={84} radius={16} />
                </StatGrid>
                <SkeletonCard lines={2} />
            </Screen>
        );
    }

    if (needsSelection) {
        return (
            <Screen>
                <EmptyState
                    icon="briefcase-outline"
                    title={t('staff.chooseBusinessOnTab', { tab: t('nav.staffTab') })}
                    message={t('staff.shifts.chooseBusinessMessage')}
                    action={
                        <Button
                            title={t('staff.openTab', { tab: t('nav.staffTab') })}
                            onPress={() => navigation.navigate('Main', { screen: 'Staff' })}
                            fullWidth
                        />
                    }
                />
            </Screen>
        );
    }

    if (!staffInfo) {
        return (
            <Screen>
                <EmptyState
                    icon="briefcase-outline"
                    title={t('staff.notStaff')}
                    message={t('staff.shifts.notStaffMessage')}
                />
            </Screen>
        );
    }

    if (statsError && !stats) {
        return (
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
                <ErrorState title={t('staff.shifts.loadError')} onRetry={() => void onRefresh()} />
            </Screen>
        );
    }

    if (!stats) return null;

    return (
        <ShiftsScreenSections
            staffName={staffInfo.full_name}
            stats={stats}
            period={period}
            refreshing={refreshing}
            onPeriodChange={setPeriod}
            onRefresh={onRefresh}
        />
    );
}
