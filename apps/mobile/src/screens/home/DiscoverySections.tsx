import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import MotionPressable from '../../components/ui/MotionPressable';
import RatingBadge from '../../components/ui/RatingBadge';
import { colors } from '../../constants/colors';
import { formatPhone } from '../../utils/format';

import { styles } from './homeScreenStyles';
import type { HomeBusiness } from './types';

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
                    label="Р’СЃРµ"
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
        <MotionPressable
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
        </MotionPressable>
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
                        ? 'РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ'
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
                <MotionPressable
                    key={business.id}
                    onPress={() => onOpenBusiness(business.slug)}
                    scale="firm"
                >
                    <Card style={styles.businessCard}>
                        <View style={styles.businessHeader}>
                            <View style={styles.businessNameRow}>
                                <Text style={styles.businessName}>{business.name}</Text>
                                <RatingBadge rating={business.rating_score ?? null} size="small" />
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
                            <Button
                                title="Записаться"
                                onPress={() => onOpenBusiness(business.slug)}
                                trailingIcon={<Ionicons name="arrow-forward" size={16} color={colors.text.light} />}
                                fullWidth
                            />
                        </View>
                    </Card>
                </MotionPressable>
            ))}
        </View>
    );
}
