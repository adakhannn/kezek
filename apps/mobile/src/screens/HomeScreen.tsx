import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../lib/supabase';
import { MainTabParamList } from '../navigation/types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Logo from '../components/Logo';
import { colors } from '../constants/colors';
import { formatPhone } from '../utils/format';

type HomeScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Home'>;

type Business = {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    phones: string[] | null;
    categories: string[] | null;
};

export default function HomeScreen() {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const { data: businesses, isLoading, refetch } = useQuery({
        queryKey: ['businesses', search, selectedCategory],
        queryFn: async () => {
            let query = supabase
                .from('businesses')
                .select('id, name, slug, address, phones, categories')
                .eq('is_approved', true);

            if (search) {
                // Безопасный поиск: экранируем специальные символы
                const safeQ = search.trim().slice(0, 100).replace(/[%_\\]/g, (char) => `\\${char}`);
                const searchPattern = `%${safeQ}%`;
                query = query.or(`name.ilike.${searchPattern},address.ilike.${searchPattern}`);
            }

            if (selectedCategory) {
                query = query.contains('categories', [selectedCategory]);
            }

            const { data, error } = await query.limit(20).order('name');
            if (error) {
                console.error('[HomeScreen] Error fetching businesses:', error);
                throw error;
            }
            console.log('[HomeScreen] Businesses loaded:', data?.length || 0);
            return data as Business[];
        },
    });

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
        await refetch();
        setRefreshing(false);
    };

    const handleBusinessPress = (slug: string) => {
        // @ts-ignore - типы навигации будут исправлены позже
        navigation.navigate('Booking', { slug });
    };

    const handleCategoryPress = (category: string | null) => {
        setSelectedCategory(category);
    };

    const handleClearSearch = () => {
        setSearch('');
        setSelectedCategory(null);
    };

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
                                    <Text style={styles.businessName}>{business.name}</Text>
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
    businessName: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
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
