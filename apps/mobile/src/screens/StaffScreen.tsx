import { ScrollView, RefreshControl, Text, View } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Card from '../components/ui/Card';
import { RootStackParamList } from '../navigation/types';
import { StaffActionButtons } from './staff/StaffActionButtons';
import { StaffUpcomingBookingCard } from './staff/StaffUpcomingBookingCard';
import { styles } from './staff/styles';
import { useStaffScreenData } from './staff/useStaffScreenData';

type StaffScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Shifts'>;

export default function StaffScreen() {
    const navigation = useNavigation<StaffScreenNavigationProp>();
    const [refreshing, setRefreshing] = useState(false);
    const {
        staffInfo,
        upcomingBookings,
        staffLoading,
        bookingsLoading,
        refetchStaff,
        refetchBookings,
    } = useStaffScreenData();

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetchStaff(), refetchBookings()]);
        setRefreshing(false);
    };

    if ((staffLoading || bookingsLoading) && !refreshing) {
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
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Кабинет сотрудника</Text>
                <Text style={styles.subtitle}>{staffInfo.full_name}</Text>
            </View>

            {staffInfo.branch && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Филиал</Text>
                    <Text style={styles.branchName}>{staffInfo.branch.name}</Text>
                </Card>
            )}

            {staffInfo.business && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Бизнес</Text>
                    <Text style={styles.businessName}>{staffInfo.business.name}</Text>
                </Card>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Предстоящие записи</Text>

                {upcomingBookings && upcomingBookings.length > 0 ? (
                    <View style={styles.bookingsList}>
                        {upcomingBookings.map((booking) => (
                            <StaffUpcomingBookingCard key={booking.id} booking={booking} />
                        ))}
                    </View>
                ) : (
                    <EmptyState
                        icon="calendar"
                        title="Нет предстоящих записей"
                        message="Записи появятся здесь, когда клиенты запишутся к вам"
                    />
                )}
            </View>

            <StaffActionButtons
                onShiftQuick={() => navigation.navigate('ShiftQuick')}
                onShiftsStats={() => navigation.navigate('Shifts')}
            />
        </ScrollView>
    );
}
