import React, { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import LoadingSpinner from '../components/ui/LoadingSpinner';
import { colors } from '../constants/colors';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

import {
    BusinessCard,
    BusinessListSection,
    CategoriesSection,
    HomeScreenHeader,
    NearbySection,
    RecentPlacesSection,
    SearchSection,
    UpcomingBookingsSection,
} from './home/HomeScreenSections';
import { styles } from './home/homeScreenStyles';
import { useHomeScreenData } from './home/useHomeScreenData';
import type { HomeBusiness } from './home/types';

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
        businessesError,
        showOfflineBanner,
        onRefresh,
        retryBusinesses,
        loadMoreBusinesses,
        hasMoreBusinesses,
        isLoadingMoreBusinesses,
        clearSearch,
        nearbyBranches,
        nearbyStatus,
        nearbyError,
        requestNearbyBranches,
    } = useHomeScreenData();

    const rootNavigation = navigation as unknown as RootNavigation;

    const handleBusinessPress = useCallback((slug: string, previewName?: string) => {
        rootNavigation.navigate('Booking', { slug, previewName });
    }, [rootNavigation]);

    const handleOpenAllBookings = useCallback(() => {
        navigation.navigate('Cabinet', { screen: 'CabinetMain' });
    }, [navigation]);

    const handleOpenBookingDetails = useCallback((bookingId: string) => {
        rootNavigation.navigate('BookingDetails', { id: bookingId });
    }, [rootNavigation]);

    const handleOpenMap = useCallback(() => {
        rootNavigation.navigate('Map');
    }, [rootNavigation]);

    const listHeader = useMemo(() => (
        <>
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

            <NearbySection
                branches={nearbyBranches}
                status={nearbyStatus}
                error={nearbyError}
                onRequestNearby={requestNearbyBranches}
                onOpenMap={handleOpenMap}
                onOpenBusiness={handleBusinessPress}
            />

            <CategoriesSection
                categories={availableCategories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
            />
        </>
    ), [
        availableCategories,
        clearSearch,
        handleBusinessPress,
        handleOpenAllBookings,
        handleOpenBookingDetails,
        handleOpenMap,
        nearbyBranches,
        nearbyError,
        nearbyStatus,
        requestNearbyBranches,
        recentPlaces,
        search,
        selectedCategory,
        setSearch,
        setSelectedCategory,
        showOfflineBanner,
        upcomingBookings,
        user,
    ]);

    const listEmpty = (
        <BusinessListSection
            businesses={businesses}
            isLoading={isBusinessesLoading}
            isRefreshing={refreshing}
            error={businessesError}
            search={search}
            selectedCategory={selectedCategory}
            onRetry={retryBusinesses}
            onClearFilters={clearSearch}
            onOpenBusiness={handleBusinessPress}
        />
    );

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
            <FlatList<HomeBusiness>
                style={styles.container}
                contentContainerStyle={styles.listContent}
                data={businesses}
                keyExtractor={(business) => business.id}
                renderItem={({ item }) => (
                    <View style={styles.businessListItem}>
                        <BusinessCard
                            business={item}
                            onOpenBusiness={handleBusinessPress}
                        />
                    </View>
                )}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={listEmpty}
                ListFooterComponent={
                    isLoadingMoreBusinesses ? (
                        <View style={styles.listFooter}>
                            <LoadingSpinner message="Загружаем ещё..." />
                        </View>
                    ) : null
                }
                onEndReached={hasMoreBusinesses ? loadMoreBusinesses : undefined}
                onEndReachedThreshold={0.5}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                updateCellsBatchingPeriod={50}
                windowSize={5}
                removeClippedSubviews
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            />
        </LinearGradient>
    );
}
