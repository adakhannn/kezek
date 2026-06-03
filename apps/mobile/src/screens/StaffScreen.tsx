import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { RootStackParamList } from '../navigation/types';
import { StaffScreenSections } from './staff/StaffScreenSections';
import { useStaffScreenData } from './staff/useStaffScreenData';
import { styles } from './staff/staffScreenStyles';

type StaffScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Shifts'>;

export default function StaffScreen() {
    const navigation = useNavigation<StaffScreenNavigationProp>();
    const { staffInfo, upcomingBookings, loadError, isLoading, refreshing, onRefresh } = useStaffScreenData();

    if (isLoading) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (loadError) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="alert-circle"
                    title="Не удалось загрузить рабочую зону"
                    message="Проверьте соединение и попробуйте снова."
                    action={<Button title="Повторить" onPress={() => void onRefresh()} variant="outline" fullWidth />}
                />
            </ScrollView>
        );
    }

    if (!staffInfo) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="briefcase"
                    title="Вы не являетесь сотрудником"
                    message="Здесь будут отображаться ваши записи после назначения сотрудником"
                />
            </ScrollView>
        );
    }

    return (
        <StaffScreenSections
            staffInfo={staffInfo}
            upcomingBookings={upcomingBookings}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onOpenShiftQuick={() => navigation.navigate('ShiftQuick')}
            onOpenShifts={() => navigation.navigate('Shifts')}
        />
    );
}
