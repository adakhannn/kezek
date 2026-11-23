import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
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
        return <LoadingSpinner message={t('common.loading')} />;
    }

    if (needsSelection) {
        return (
            <EmptyState
                icon="briefcase"
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
        );
    }

    if (!staffInfo) {
        return (
            <EmptyState
                icon="briefcase"
                title={t('staff.notStaff')}
                message={t('staff.shifts.notStaffMessage')}
            />
        );
    }

    if (statsError && !stats) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('staff.shifts.loadError')}
                message={t('staff.checkConnection')}
                action={<Button title={t('staff.retry')} onPress={() => void onRefresh()} fullWidth />}
            />
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
