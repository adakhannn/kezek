import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { apiRequest } from '../lib/api';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Logo from '../components/Logo';
import RatingBadge from '../components/ui/RatingBadge';
import { colors } from '../constants/colors';
import { formatDate, formatTime, formatPhone } from '../utils/format';
import { logError, logDebug } from '../lib/log';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import type { ClientBookingListItemDto, PublicBusinessDto } from '@shared-client/types';

type HomeScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Home'>;

type Business = {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    phones: string[] | null;
    categories: string[] | null;
    rating_score: number | null;
};

type HomeBooking = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    business: {
        name: string;
        slug: string | null;
    } | null;
    branch: {
        name: string | null;
    } | null;
    service: {
        name_ru: string | null;
    } | null;
};

type RecentPlace = {
    slug: string;
    name: string;
};

export default function HomeScreen() {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [hasNetworkError, setHasNetworkError] = useState(false);

    const { isOffline } = useNetworkStatus();

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const {
                data: { user },
                error,
            } = await supabase.auth.getUser();
            if (error) throw error;
            return user;
        },
    });

    const { data: businesses, isLoading, refetch } = useQuery({
        queryKey: ['businesses', search, selectedCategory],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search.trim()) {
                params.set('search', search.trim());
            }
            if (selectedCategory) {
                params.set('category', selectedCategory);
            }
            const endpoint = `/mobile/businesses${params.toString() ? `?${params.toString()}` : ''}`;
            const data = await apiRequest<PublicBusinessDto[]>(endpoint);
            logDebug('HomeScreen', 'Businesses loaded', { count: data?.length || 0 });
            return (data ?? []).map(
                (b): Business => ({
                    id: b.id,
                    name: b.name,
                    slug: b.slug,
                    address: b.address,
                    phones: b.phones,
                    categories: b.categories,
                    rating_score: b.rating_score,
                }),
            );
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            if (/network request failed|failed to fetch|network/i.test(message)) {
                setHasNetworkError(true);
            }
        },
        onSuccess: () => {
            setHasNetworkError(false);
        },
    });

    const { data: bookings } = useQuery({
        queryKey: ['home-bookings', user?.id],
        enabled: !!user?.id,
        queryFn: async () => {
            if (!user?.id) return [];

            const data = await apiRequest<ClientBookingListItemDto[]>('/mobile/bookings');
            logDebug('HomeScreen', 'Home bookings loaded', { count: data?.length || 0 });
            return (data ?? []).map(
                (b): HomeBooking => ({
                    id: b.id,
                    start_at: b.start_at,
                    end_at: b.end_at,
                    status: b.status,
                    business: b.business
                        ? {
                              name: b.business.name ?? '',
                              slug: b.business.slug ?? null,
                          }
                        : null,
                    branch: b.branch
                        ? {
                              name: b.branch.name ?? null,
                          }
                        : null,
                    service: b.service
                        ? {
                              name_ru: b.service.name_ru ?? '',
                          }
                        : null,
                }),
            );
        },
    });

    const now = useMemo(() => new Date(), []);

    const upcomingBookings = useMemo(() => {
        if (!bookings || bookings.length === 0) return [] as HomeBooking[];
        const nowTime = now.getTime();
        return bookings
            .filter((b) => {
                if (b.status === 'cancelled' || b.status === 'no_show') return false;
                const start = new Date(b.start_at).getTime();
                return Number.isFinite(start) && start >= nowTime;
            })
            .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
            .slice(0, 3);
    }, [bookings, now]);

    const recentPlaces: RecentPlace[] = useMemo(() => {
        if (!bookings || bookings.length === 0) return [];
        const seen = new Set<string>();
        const places: RecentPlace[] = [];

        [...bookings]
            .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
            .forEach((b) => {
                const slug = b.business?.slug;
                const name = b.business?.name;
                if (!slug || !name) return;
                if (seen.has(slug)) return;
                seen.add(slug);
                places.push({ slug, name });
            });

        return places.slice(0, 3);
    }, [bookings]);

    // Собираем доступные категории из загруженных бизнесов
    const availableCategories = useMemo(() => {
        if (!businesses) return [];
        const cats = new Set<string>();
        businesses.forEach((b) => {
            if (b.categories) {
                b.categories.forEach((c) => cats.add(c));
            }
        });
        return Array.from(cats).sort();
    }, [businesses]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetch()]);
        setRefreshing(false);
    };

    const handleBusinessPress = (slug: string) => {
        // Навигация в Booking находится в RootStack, поэтому используем type assertion
        (navigation as unknown as { navigate: (screen: keyof RootStackParamList, params?: RootStackParamList[keyof RootStackParamList]) => void }).navigate('Booking', { slug });
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
                {/* Header с логотипом */}
                <View style={styles.header}>
                    <Logo style={styles.logo} />
                </View>

            {/* Заголовок с градиентом */}
            <View style={styles.heroSection}>
                <Text style={styles.heroTitle}>Найдите свой сервис</Text>
                <Text style={styles.heroSubtitle}>
                    Запись в салоны и студии города Ош за пару кликов — без звонков и переписок
                </Text>
            </View>

            {showOfflineBanner && (
                <View style={styles.offlineBanner}>
                    <Ionicons name="cloud-offline-outline" size={18} color={colors.text.secondary} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.offlineTitle}>Нет подключения к интернету</Text>
                        <Text style={styles.offlineText}>
                            Список обновится автоматически, когда сеть появится. Попробуйте потянуть вниз для обновления.
                        </Text>
                    </View>
                </View>
            )}

            {/* Ближайшие записи */}
            {user && upcomingBookings.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Ближайшие записи</Text>
                        <TouchableOpacity
                            onPress={() =>
                                (navigation as unknown as {
                                    navigate: (screen: keyof RootStackParamList, params?: RootStackParamList[keyof RootStackParamList]) => void;
                                }).navigate('CabinetMain' as any)
                            }
                        >
                            <Text style={styles.sectionLink}>Открыть все</Text>
                        </TouchableOpacity>
                    </View>
                    {upcomingBookings.map((b) => (
                        <Card key={b.id} style={styles.bookingCard}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() =>
                                    (navigation as unknown as {
                                        navigate: (
                                            screen: keyof RootStackParamList,
                                            params?: RootStackParamList[keyof RootStackParamList],
                                        ) => void;
                                    }).navigate('BookingDetails', { id: b.id })
                                }
                            >
                                <View style={styles.bookingRow}>
                                    <View style={styles.bookingMain}>
                                        <Text style={styles.bookingBusiness}>
                                            {b.business?.name || 'Запись'}
                                        </Text>
                                        {b.branch?.name && (
                                            <Text style={styles.bookingBranch}>{b.branch.name}</Text>
                                        )}
                                        {b.service?.name_ru && (
                                            <Text style={styles.bookingService}>{b.service.name_ru}</Text>
                                        )}
                                    </View>
                                    <View style={styles.bookingMeta}>
                                        <Text style={styles.bookingDate}>
                                            {formatDate(b.start_at)} • {formatTime(b.start_at)}
                                        </Text>
                                        <View style={styles.bookingStatusPill}>
                                            <Text style={styles.bookingStatusText}>
                                                {b.status === 'confirmed'
                                                    ? 'Подтверждено'
                                                    : b.status === 'hold'
                                                    ? 'Ожидает'
                                                    : b.status === 'paid'
                                                    ? 'Оплачено'
                                                    : 'Запись'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </Card>
                    ))}
                </View>
            )}

            {/* Поиск */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Ionicons name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Поиск по названию или адресу..."
                        placeholderTextColor={colors.text.tertiary}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search && (
                        <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
                            <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Недавние места */}
            {user && recentPlaces.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Недавние места</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.recentPlacesRow}
                    >
                        {recentPlaces.map((place) => (
                            <TouchableOpacity
                                key={place.slug}
                                style={styles.recentPlaceChip}
                                activeOpacity={0.7}
                                onPress={() => handleBusinessPress(place.slug)}
                            >
                                <Ionicons
                                    name="time-outline"
                                    size={16}
                                    color={colors.text.secondary}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={styles.recentPlaceText}>{place.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Фильтры по категориям */}
            {availableCategories.length > 0 && (
                <View style={styles.categoriesContainer}>
                    <Text style={styles.categoriesLabel}>Популярные категории:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                        <TouchableOpacity
                            style={[
                                styles.categoryChip,
                                !selectedCategory && styles.categoryChipActive,
                            ]}
                            onPress={() => handleCategoryPress(null)}
                        >
                            {!selectedCategory ? (
                                <LinearGradient
                                    colors={[colors.primary.from, colors.primary.to]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.categoryChipGradient}
                                >
                                    <Text style={styles.categoryChipTextActive}>Все</Text>
                                </LinearGradient>
                            ) : (
                                <Text style={styles.categoryChipText}>Все</Text>
                            )}
                        </TouchableOpacity>
                        {availableCategories.map((category) => (
                            <TouchableOpacity
                                key={category}
                                style={[
                                    styles.categoryChip,
                                    selectedCategory === category && styles.categoryChipActive,
                                ]}
                                onPress={() => handleCategoryPress(category)}
                            >
                                {selectedCategory === category ? (
                                    <LinearGradient
                                        colors={[colors.primary.from, colors.primary.to]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.categoryChipGradient}
                                    >
                                        <Text style={styles.categoryChipTextActive}>{category}</Text>
                                    </LinearGradient>
                                ) : (
                                    <Text style={styles.categoryChipText}>{category}</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Список бизнесов */}
            {isLoading && !refreshing ? (
                <LoadingSpinner message="Загрузка..." />
            ) : businesses && businesses.length > 0 ? (
                <View style={styles.businessList}>
                    {businesses.map((business) => (
                        <TouchableOpacity
                            key={business.id}
                            onPress={() => handleBusinessPress(business.slug)}
                            activeOpacity={0.7}
                        >
                            <Card style={styles.businessCard}>
                                <View style={styles.businessHeader}>
                                    <View style={styles.businessNameRow}>
                                        <Text style={styles.businessName}>{business.name}</Text>
                                        <RatingBadge rating={business.rating_score ?? null} size="small" />
                                    </View>
                                </View>

                                {business.address && (
                                    <View style={styles.businessInfo}>
                                        <Ionicons name="location-outline" size={16} color={colors.text.secondary} />
                                        <Text style={styles.businessAddress}>{business.address}</Text>
                                    </View>
                                )}

                                {business.phones && business.phones.length > 0 && (
                                    <View style={styles.businessInfo}>
                                        <Ionicons name="call-outline" size={16} color={colors.text.secondary} />
                                        <Text style={styles.businessPhone}>
                                            {formatPhone(business.phones[0])}
                                        </Text>
                                    </View>
                                )}

                                {business.categories && business.categories.length > 0 && (
                                    <View style={styles.businessCategories}>
                                        {business.categories.map((cat) => (
                                            <View key={cat} style={styles.businessCategoryTag}>
                                                <Text style={styles.businessCategoryText}>{cat}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                <View style={styles.businessFooter}>
                                    <LinearGradient
                                        colors={[colors.primary.from, colors.primary.to]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.bookButton}
                                    >
                                        <Text style={styles.bookButtonText}>Записаться</Text>
                                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                                    </LinearGradient>
                                </View>
                            </Card>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : (
                <EmptyState
                    icon="search"
                    title={search || selectedCategory ? 'Ничего не найдено' : 'Нет доступных бизнесов'}
                    message={search || selectedCategory ? 'Попробуйте другой запрос' : 'Бизнесы появятся здесь после регистрации'}
                />
            )}
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
    offlineBanner: {
        marginHorizontal: 20,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.light,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    offlineTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 2,
    },
    offlineText: {
        fontSize: 12,
        color: colors.text.secondary,
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
