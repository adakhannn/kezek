import { StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { HomeBusinessListSection } from './home/HomeBusinessListSection';
import { HomeCategoriesSection } from './home/HomeCategoriesSection';
import { HomeHeroSection } from './home/HomeHeroSection';
import { HomeOfflineBannerSection } from './home/HomeOfflineBannerSection';
import { HomeRecentPlacesSection } from './home/HomeRecentPlacesSection';
import { HomeSearchSection } from './home/HomeSearchSection';
import { HomeUpcomingBookingsSection } from './home/HomeUpcomingBookingsSection';
import { trackMobileEvent } from '../lib/analytics';
import { getAvailableCategories, getRecentPlaces, getUpcomingBookings } from './home/selectors';
import type { RecentPlace } from './home/types';
import { useHomeData } from './home/useHomeData';

type HomeScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Home'>;

export default function HomeScreen() {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [hasNetworkError, setHasNetworkError] = useState(false);

    const { isOffline } = useNetworkStatus();

    // Аналитика: фиксируем первое открытие домашнего экрана за сессию.
    useEffect(() => {
        trackMobileEvent({ eventType: 'home_view' });
    }, []);

    const { user, businessesQuery, bookingsQuery } = useHomeData({
        search,
        selectedCategory,
        onNetworkError: setHasNetworkError,
    });

    const businesses = businessesQuery.data;
    const bookings = bookingsQuery.data;
    const isLoading = businessesQuery.isLoading;
    const refetch = businessesQuery.refetch;

    const now = useMemo(() => new Date(), []);

    const upcomingBookings = useMemo(() => {
        return getUpcomingBookings(bookings, now);
    }, [bookings, now]);

    const recentPlaces: RecentPlace[] = useMemo(() => {
        return getRecentPlaces(bookings);
    }, [bookings]);

    // Собираем доступные категории из загруженных бизнесов.
    const availableCategories = useMemo(() => {
        return getAvailableCategories(businesses);
    }, [businesses]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetch()]);
        setRefreshing(false);
    };

    const handleBusinessPress = (slug: string) => {
        // Навигация в Booking живет в RootStack, поэтому здесь нужен type assertion.
        (navigation as unknown as { navigate: (screen: keyof RootStackParamList, params?: RootStackParamList[keyof RootStackParamList]) => void }).navigate('Booking', { slug });
    };

    const handleOpenAllBookings = () => {
        (navigation as unknown as {
            navigate: (screen: keyof RootStackParamList, params?: RootStackParamList[keyof RootStackParamList]) => void;
        }).navigate('CabinetMain' as any);
    };

    const handleOpenBookingDetails = (id: string) => {
        (navigation as unknown as {
            navigate: (
                screen: keyof RootStackParamList,
                params?: RootStackParamList[keyof RootStackParamList],
            ) => void;
        }).navigate('BookingDetails', { id });
    };

    const handleCategoryPress = (category: string | null) => {
        setSelectedCategory(category);
    };

    const handleClearSearch = () => {
        setSearch('');
        setSelectedCategory(null);
    };

    const showOfflineBanner = isOffline || hasNetworkError;

    return (
        <LinearGradient
            colors={[colors.background.gradient.from, colors.background.gradient.via, colors.background.gradient.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
        >
            <ScrollView
                style={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <HomeHeroSection styles={styles} />

                <HomeOfflineBannerSection
                    styles={styles}
                    visible={showOfflineBanner}
                />

                <HomeUpcomingBookingsSection
                    user={user}
                    bookings={upcomingBookings}
                    styles={styles}
                    onOpenAll={handleOpenAllBookings}
                    onOpenBooking={handleOpenBookingDetails}
                />

                <HomeSearchSection
                    styles={styles}
                    search={search}
                    onChangeSearch={setSearch}
                    onClear={handleClearSearch}
                />

                <HomeRecentPlacesSection
                    user={user}
                    places={recentPlaces}
                    styles={styles}
                    onOpenPlace={handleBusinessPress}
                />

                <HomeCategoriesSection
                    styles={styles}
                    categories={availableCategories}
                    selectedCategory={selectedCategory}
                    onSelectCategory={handleCategoryPress}
                />

                <HomeBusinessListSection
                    styles={styles}
                    isLoading={isLoading}
                    refreshing={refreshing}
                    businesses={businesses}
                    search={search}
                    selectedCategory={selectedCategory}
                    onOpenBusiness={handleBusinessPress}
                />
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    header: {
        padding: 24,
        paddingTop: 32,
        backgroundColor: colors.background.secondary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.dark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        marginBottom: 0,
        width: '100%',
    },
    heroSection: {
        padding: 24,
        paddingTop: 32,
        alignItems: 'center',
    },
    heroTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: 12,
        textAlign: 'center',
    },
    heroSubtitle: {
        fontSize: 16,
        color: colors.text.secondary,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 320,
    },
    offlineBannerWrapper: {
        marginHorizontal: 20,
        marginBottom: 12,
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.light,
        borderRadius: 12,
        paddingHorizontal: 16,
        ...colors.shadow.sm,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: colors.text.primary,
        paddingVertical: 14,
    },
    clearButton: {
        padding: 4,
    },
    categoriesContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    categoriesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    categoriesScroll: {
        flexDirection: 'row',
    },
    categoryChip: {
        marginRight: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.background.secondary,
        overflow: 'hidden',
    },
    categoryChipActive: {
        borderColor: 'transparent',
    },
    categoryChipGradient: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryChipText: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.text.secondary,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    categoryChipTextActive: {
        fontSize: 12,
        fontWeight: '500',
        color: '#fff',
    },
    section: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
    },
    sectionLink: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.primary.from,
    },
    bookingCard: {
        marginTop: 8,
    },
    bookingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    bookingMain: {
        flex: 1,
    },
    bookingBusiness: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 2,
    },
    bookingBranch: {
        fontSize: 13,
        color: colors.text.secondary,
        marginBottom: 2,
    },
    bookingService: {
        fontSize: 13,
        color: colors.text.tertiary,
    },
    bookingMeta: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 4,
    },
    bookingDate: {
        fontSize: 12,
        color: colors.text.secondary,
    },
    bookingStatusPill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: colors.background.secondary,
    },
    bookingStatusText: {
        fontSize: 11,
        fontWeight: '500',
        color: colors.text.secondary,
    },
    recentPlacesRow: {
        paddingTop: 8,
        paddingBottom: 4,
        gap: 8,
    },
    recentPlaceChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.light,
        marginRight: 8,
    },
    recentPlaceText: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.text.primary,
    },
    businessList: {
        padding: 20,
        gap: 16,
        paddingBottom: 40,
    },
    businessCard: {
        marginBottom: 0,
    },
    businessHeader: {
        marginBottom: 12,
    },
    businessNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    businessName: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
        flex: 1,
    },
    businessInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    businessAddress: {
        fontSize: 14,
        color: colors.text.secondary,
        flex: 1,
    },
    businessPhone: {
        fontSize: 12,
        color: colors.text.tertiary,
    },
    businessCategories: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
        marginBottom: 16,
    },
    businessCategoryTag: {
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    businessCategoryText: {
        fontSize: 11,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    businessFooter: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border.dark,
    },
    bookButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
        ...colors.shadow.md,
    },
    bookButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    empty: {
        padding: 40,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyHint: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
});


