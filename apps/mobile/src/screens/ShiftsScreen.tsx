import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ShiftsScreenSections } from './shifts/ShiftsScreenSections';
import { useShiftsScreenData } from './shifts/useShiftsScreenData';

export default function ShiftsScreen() {
    const { period, setPeriod, refreshing, staffInfo, staffLoading, stats, statsLoading, onRefresh } =
        useShiftsScreenData();

    if (staffLoading || (statsLoading && !refreshing)) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (!staffInfo) {
        return (
            <EmptyState
                icon="briefcase"
                title="Вы не являетесь сотрудником"
                message="Здесь будут отображаться ваши смены после назначения сотрудником"
            />
        );
    }

    if (!stats) {
        return (
            <EmptyState
                icon="calendar"
                title="Нет данных"
                message="Не удалось загрузить статистику смен"
            />
        );
    }

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
