import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { RootStackParamList } from '../navigation/types';
import { StaffScreenSections } from './staff/StaffScreenSections';
import { useStaffScreenData } from './staff/useStaffScreenData';
import { styles } from './staff/staffScreenStyles';

type StaffScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Shifts'>;

export default function StaffScreen() {
    const navigation = useNavigation<StaffScreenNavigationProp>();
    const { staffInfo, upcomingBookings, isLoading, refreshing, onRefresh } = useStaffScreenData();

    if (isLoading) {
        return <LoadingSpinner message="Загрузка..." />;
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
