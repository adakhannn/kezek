import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Logo from '../../components/Logo';
import OfflineBanner from '../../components/ui/OfflineBanner';
import RatingBadge from '../../components/ui/RatingBadge';
import { colors } from '../../constants/colors';
import { formatDate, formatPhone, formatTime } from '../../utils/format';

import { styles } from './homeScreenStyles';
import type { HomeBooking, HomeBusiness, RecentPlace } from './types';

type HeaderProps = {
    showOfflineBanner: boolean;
};

type SearchSectionProps = {
    search: string;
    onSearchChange: (value: string) => void;
    onClear: () => void;
};

type UpcomingBookingsSectionProps = {
    bookings: HomeBooking[];
    onOpenAll: () => void;
    onOpenBooking: (bookingId: string) => void;
};

type RecentPlacesSectionProps = {
    places: RecentPlace[];
    onOpenPlace: (slug: string) => void;
};

type CategoriesSectionProps = {
    categories: string[];
    selectedCategory: string | null;
    onSelectCategory: (category: string | null) => void;
};

type BusinessListSectionProps = {
    businesses: HomeBusiness[];
    isLoading: boolean;
    isRefreshing: boolean;
    search: string;
    selectedCategory: string | null;
    onOpenBusiness: (slug: string) => void;
};

function getBookingStatusLabel(status: string) {
    if (status === 'confirmed') {
        return 'Подтверждено';
    }

    if (status === 'hold') {
        return 'Ожидает';
    }

    if (status === 'paid') {
        return 'Оплачено';
    }

    return 'Запись';
}

export function HomeScreenHeader({ showOfflineBanner }: HeaderProps) {
    return (
        <>
            <View style={styles.header}>
                <Logo style={styles.logo} />
            </View>

            <View style={styles.heroSection}>
                <Text style={styles.heroTitle}>Найдите свой сервис</Text>
                <Text style={styles.heroSubtitle}>
                    Запись в салоны и студии города Ош за пару кликов - без звонков и
                    переписок
                </Text>
            </View>

            {showOfflineBanner && (
                <View style={styles.offlineBannerWrapper}>
                    <OfflineBanner />
                </View>
            )}
        </>
    );
}

export function SearchSection({
    search,
    onSearchChange,
    onClear,
}: SearchSectionProps) {
    return (
        <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
                <Ionicons
                    name="search"
                    size={20}
                    color={colors.text.secondary}
                    style={styles.searchIcon}
                />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Поиск по названию или адресу..."
                    placeholderTextColor={colors.text.tertiary}
                    value={search}
                    onChangeText={onSearchChange}
                />
                {search ? (
                    <TouchableOpacity onPress={onClear} style={styles.clearButton}>
                        <Ionicons
                            name="close-circle"
                            size={20}
                            color={colors.text.secondary}
                        />
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}

export function UpcomingBookingsSection({
    bookings,
    onOpenAll,
    onOpenBooking,
}: UpcomingBookingsSectionProps) {
    if (bookings.length === 0) {
        return null;
    }

    return (
        <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Ближайшие записи</Text>
                <TouchableOpacity onPress={onOpenAll}>
                    <Text style={styles.sectionLink}>Открыть все</Text>
                </TouchableOpacity>
            </View>

            {bookings.map((booking) => (
                <Card key={booking.id} style={styles.bookingCard}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => onOpenBooking(booking.id)}
                    >
                        <View style={styles.bookingRow}>
                            <View style={styles.bookingMain}>
                                <Text style={styles.bookingBusiness}>
                                    {booking.business?.name || 'Запись'}
                                </Text>
                                {booking.branch?.name ? (
                                    <Text style={styles.bookingBranch}>
                                        {booking.branch.name}
                                    </Text>
                                ) : null}
                                {booking.service?.name_ru ? (
                                    <Text style={styles.bookingService}>
                                        {booking.service.name_ru}
                                    </Text>
                                ) : null}
                            </View>

                            <View style={styles.bookingMeta}>
                                <Text style={styles.bookingDate}>
                                    {formatDate(booking.start_at)} • {formatTime(booking.start_at)}
                                </Text>
                                <View style={styles.bookingStatusPill}>
                                    <Text style={styles.bookingStatusText}>
                                        {getBookingStatusLabel(booking.status)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                </Card>
            ))}
        </View>
    );
}

export function RecentPlacesSection({
    places,
    onOpenPlace,
}: RecentPlacesSectionProps) {
    if (places.length === 0) {
        return null;
    }

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Недавние места</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentPlacesRow}
            >
                {places.map((place) => (
                    <TouchableOpacity
                        key={place.slug}
                        style={styles.recentPlaceChip}
                        activeOpacity={0.7}
                        onPress={() => onOpenPlace(place.slug)}
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
    );
}

export function CategoriesSection({
    categories,
    selectedCategory,
    onSelectCategory,
}: CategoriesSectionProps) {
    if (categories.length === 0) {
        return null;
    }

    return (
        <View style={styles.categoriesContainer}>
            <Text style={styles.categoriesLabel}>Популярные категории:</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesScroll}
            >
                <CategoryChip
                    label="Все"
                    isActive={!selectedCategory}
                    onPress={() => onSelectCategory(null)}
                />
                {categories.map((category) => (
                    <CategoryChip
                        key={category}
                        label={category}
                        isActive={selectedCategory === category}
                        onPress={() => onSelectCategory(category)}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

function CategoryChip({
    label,
    isActive,
    onPress,
}: {
    label: string;
    isActive: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.categoryChip, isActive && styles.categoryChipActive]}
            onPress={onPress}
        >
            {isActive ? (
                <LinearGradient
                    colors={[colors.primary.from, colors.primary.to]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.categoryChipGradient}
                >
                    <Text style={styles.categoryChipTextActive}>{label}</Text>
                </LinearGradient>
            ) : (
                <Text style={styles.categoryChipText}>{label}</Text>
            )}
        </TouchableOpacity>
    );
}

export function BusinessListSection({
    businesses,
    isLoading,
    isRefreshing,
    search,
    selectedCategory,
    onOpenBusiness,
}: BusinessListSectionProps) {
    if (isLoading && !isRefreshing) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (businesses.length === 0) {
        return (
            <EmptyState
                icon="search"
                title={
                    search || selectedCategory
                        ? 'Ничего не найдено'
                        : 'Нет доступных бизнесов'
                }
                message={
                    search || selectedCategory
                        ? 'Попробуйте другой запрос'
                        : 'Бизнесы появятся здесь после регистрации'
                }
            />
        );
    }

    return (
        <View style={styles.businessList}>
            {businesses.map((business) => (
                <TouchableOpacity
                    key={business.id}
                    onPress={() => onOpenBusiness(business.slug)}
                    activeOpacity={0.7}
                >
                    <Card style={styles.businessCard}>
                        <View style={styles.businessHeader}>
                            <View style={styles.businessNameRow}>
                                <Text style={styles.businessName}>{business.name}</Text>
                                <RatingBadge
                                    rating={business.rating_score ?? null}
                                    size="small"
                                />
                            </View>
                        </View>

                        {business.address ? (
                            <View style={styles.businessInfo}>
                                <Ionicons
                                    name="location-outline"
                                    size={16}
                                    color={colors.text.secondary}
                                />
                                <Text style={styles.businessAddress}>
                                    {business.address}
                                </Text>
                            </View>
                        ) : null}

                        {business.phones?.length ? (
                            <View style={styles.businessInfo}>
                                <Ionicons
                                    name="call-outline"
                                    size={16}
                                    color={colors.text.secondary}
                                />
                                <Text style={styles.businessPhone}>
                                    {formatPhone(business.phones[0])}
                                </Text>
                            </View>
                        ) : null}

                        {business.categories?.length ? (
                            <View style={styles.businessCategories}>
                                {business.categories.map((category) => (
                                    <View key={category} style={styles.businessCategoryTag}>
                                        <Text style={styles.businessCategoryText}>
                                            {category}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}

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
    );
}
