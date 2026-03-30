import React from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../constants/colors';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

import {
    BusinessListSection,
    CategoriesSection,
    HomeScreenHeader,
    RecentPlacesSection,
    SearchSection,
    UpcomingBookingsSection,
} from './home/HomeScreenSections';
import { styles } from './home/homeScreenStyles';
import { useHomeScreenData } from './home/useHomeScreenData';

type HomeScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Home'>;

type RootNavigation = {
    navigate: (
        screen: keyof RootStackParamList,
        params?: RootStackParamList[keyof RootStackParamList],
    ) => void;
};

export default function HomeScreen() {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const {
        user,
        search,
        setSearch,
        selectedCategory,
        setSelectedCategory,
        refreshing,
        businesses,
        upcomingBookings,
        recentPlaces,
        availableCategories,
        isBusinessesLoading,
        showOfflineBanner,
        onRefresh,
        clearSearch,
    } = useHomeScreenData();

    const rootNavigation = navigation as unknown as RootNavigation;

    const handleBusinessPress = (slug: string) => {
        rootNavigation.navigate('Booking', { slug });
    };

    const handleOpenAllBookings = () => {
        navigation.navigate('Cabinet', { screen: 'CabinetMain' });
    };

    const handleOpenBookingDetails = (bookingId: string) => {
        rootNavigation.navigate('BookingDetails', { id: bookingId });
    };

    return (
        <LinearGradient
            colors={[
                colors.background.gradient.from,
                colors.background.gradient.via,
                colors.background.gradient.to,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
        >
            <ScrollView
                style={styles.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <HomeScreenHeader showOfflineBanner={showOfflineBanner} />

                {user ? (
                    <UpcomingBookingsSection
                        bookings={upcomingBookings}
                        onOpenAll={handleOpenAllBookings}
                        onOpenBooking={handleOpenBookingDetails}
                    />
                ) : null}

                <SearchSection
                    search={search}
                    onSearchChange={setSearch}
                    onClear={clearSearch}
                />

                {user ? (
                    <RecentPlacesSection
                        places={recentPlaces}
                        onOpenPlace={handleBusinessPress}
                    />
                ) : null}

                <CategoriesSection
                    categories={availableCategories}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                />

                <BusinessListSection
                    businesses={businesses}
                    isLoading={isBusinessesLoading}
                    isRefreshing={refreshing}
                    search={search}
                    selectedCategory={selectedCategory}
                    onOpenBusiness={handleBusinessPress}
                />
            </ScrollView>
        </LinearGradient>
    );
}
