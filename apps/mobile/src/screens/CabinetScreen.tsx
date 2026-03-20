import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import { CabinetStackParamList, RootStackParamList } from '../navigation/types';
import { CabinetBookingListSection } from './cabinet/CabinetBookingListSection';
import { CabinetHeader } from './cabinet/CabinetHeader';
import { CabinetOfflineBanner } from './cabinet/CabinetOfflineBanner';
import { CabinetScreenLoading } from './cabinet/CabinetScreenLoading';
import { CabinetTabs } from './cabinet/CabinetTabs';
import { styles } from './cabinet/styles';
import type { CabinetTab } from './cabinet/types';
import { useCabinetData } from './cabinet/useCabinetData';

type CabinetScreenNavigationProp = NativeStackNavigationProp<CabinetStackParamList, 'CabinetMain'>;

export default function CabinetScreen() {
    const navigation = useNavigation<CabinetScreenNavigationProp>();
    const [activeTab, setActiveTab] = useState<CabinetTab>('upcoming');
    const { user, bookings, isLoading, refreshing, onRefresh, isOfflineSource, lastSyncAt, upcomingBookings, pastBookings } =
        useCabinetData();

    const handleBookingPress = (bookingId: string) => {
        (
            navigation as unknown as {
                navigate: (
                    screen: keyof RootStackParamList,
                    params?: RootStackParamList[keyof RootStackParamList]
                ) => void;
            }
        ).navigate('BookingDetails', { id: bookingId });
    };

    if (isLoading && !bookings) {
        return <CabinetScreenLoading />;
    }

    return (
        <ScrollView
            style={styles.container}
            testID="cabinet-screen"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <CabinetHeader user={user} />

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Мои записи</Text>

                <CabinetTabs activeTab={activeTab} setActiveTab={setActiveTab} />

                {isOfflineSource && <CabinetOfflineBanner lastSyncAt={lastSyncAt} />}

                {activeTab === 'upcoming' ? (
                    <CabinetBookingListSection
                        bookings={upcomingBookings}
                        emptyText="У вас пока нет записей"
                        emptyHint="Запишитесь на услугу, чтобы увидеть её здесь"
                        onBookingPress={handleBookingPress}
                    />
                ) : (
                    <CabinetBookingListSection
                        bookings={pastBookings}
                        emptyText="У вас пока нет прошедших записей"
                        emptyHint="Здесь появятся завершённые записи после первой синхронизации"
                        onBookingPress={handleBookingPress}
                    />
                )}
            </View>

            <View style={styles.footer}>
                <Button title="Профиль" onPress={() => navigation.navigate('Profile')} variant="outline" />
            </View>
        </ScrollView>
    );
}
