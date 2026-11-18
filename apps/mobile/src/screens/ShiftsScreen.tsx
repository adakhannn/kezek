import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { RootStackParamList } from '../navigation/types';
import { ShiftsScreenSections } from './shifts/ShiftsScreenSections';
import { useShiftsScreenData } from './shifts/useShiftsScreenData';

type ShiftsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Shifts'>;

export default function ShiftsScreen() {
    const navigation = useNavigation<ShiftsScreenNavigationProp>();
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
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (needsSelection) {
        return (
            <EmptyState
                icon="briefcase"
                title="Выберите бизнес на вкладке «Работа»"
                message="Вы работаете в нескольких бизнесах. Статистика смен показывается для выбранного."
                action={
                    <Button
                        title="Открыть вкладку «Работа»"
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
                title="Вы не являетесь сотрудником"
                message="Здесь будут отображаться ваши смены после назначения сотрудником."
            />
        );
    }

    if (statsError && !stats) {
        return (
            <EmptyState
                icon="alert-circle"
                title="Не удалось загрузить историю смен"
                message="Проверьте соединение и попробуйте снова."
                action={<Button title="Повторить" onPress={() => void onRefresh()} fullWidth />}
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
