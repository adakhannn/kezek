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
import type { HomeBusiness, NearbyBranch, NearbyStatus } from './types';

type CategoriesSectionProps = {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
};

type BusinessListSectionProps = {
  businesses: HomeBusiness[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: unknown;
  search: string;
  selectedCategory: string | null;
  onRetry: () => void;
  onClearFilters: () => void;
  onOpenBusiness: (slug: string, previewName?: string) => void;
};

type BusinessCardProps = {
  business: HomeBusiness;
  onOpenBusiness: (slug: string, previewName?: string) => void;
};

type NearbySectionProps = {
  branches: NearbyBranch[];
  status: NearbyStatus;
  error: unknown;
  onRequestNearby: () => void;
  onOpenMap: () => void;
  onOpenBusiness: (slug: string, previewName?: string) => void;
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
        <CategoryChip label="Все" isActive={!selectedCategory} onPress={() => onSelectCategory(null)} />
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

export function NearbySection({
  branches,
  status,
  error,
  onRequestNearby,
  onOpenMap,
  onOpenBusiness,
}: NearbySectionProps) {
  const isBusy = status === 'locating' || status === 'loading';
  const hasError = status === 'denied' || status === 'unavailable' || status === 'error';
  const hasBranches = status === 'ready' && branches.length > 0;
  const errorCopy = getNearbyStatusCopy(status, error);

  return (
    <View style={styles.nearbyFallbackContainer}>
      <Card style={styles.nearbyFallbackCard}>
        <View style={[styles.nearbyFallbackIcon, hasError && styles.nearbyFallbackIconWarning]}>
          <Ionicons
            name="navigate-outline"
            size={18}
            color={colors.primary.from}
            accessible={false}
            importantForAccessibility="no"
          />
        </View>
        <View style={styles.nearbyFallbackContent}>
          <Text style={styles.nearbyFallbackTitle}>Ближайшие филиалы</Text>
          <Text style={styles.nearbyFallbackText}>{errorCopy}</Text>

          {hasBranches ? (
            <View style={styles.nearbyBranchList}>
              {branches.map((branch) => (
                <NearbyBranchRow
                  key={branch.id}
                  branch={branch}
                  onOpenBusiness={onOpenBusiness}
                />
              ))}
            </View>
          ) : null}

          {status === 'ready' && branches.length === 0 ? (
            <Text style={styles.nearbyFallbackHint}>
              В радиусе 20 км ничего не нашли. Можно выбрать бизнес из общего списка ниже.
            </Text>
          ) : null}

          <Button
            title={isBusy ? 'Ищем рядом...' : status === 'idle' ? 'Найти рядом' : 'Обновить геолокацию'}
            onPress={onRequestNearby}
            variant={hasBranches ? 'outline' : 'secondary'}
            size="sm"
            loading={isBusy}
            fullWidth
            style={styles.nearbyAction}
            accessibilityLabel="Найти ближайшие филиалы"
            accessibilityHint="Запрашивает разрешение на геолокацию и показывает ближайшие филиалы"
          />
          <Button
            title="Открыть карту филиалов"
            onPress={onOpenMap}
            variant="outline"
            size="sm"
            fullWidth
            style={styles.nearbyMapAction}
            leadingIcon={<Ionicons name="map-outline" size={16} color={colors.text.primary} />}
            accessibilityLabel="Открыть карту филиалов"
            accessibilityHint="Открывает интерактивную карту филиалов как на сайте"
          />
        </View>
      </Card>
    </View>
  );
}

function NearbyBranchRow({
  branch,
  onOpenBusiness,
}: {
  branch: NearbyBranch;
  onOpenBusiness: (slug: string, previewName?: string) => void;
}) {
  const canOpen = Boolean(branch.businessSlug);
  const openBranch = () => {
    if (branch.businessSlug) {
      onOpenBusiness(branch.businessSlug, branch.businessName);
    }
  };

  return (
    <MotionPressable
      onPress={openBranch}
      disabled={!canOpen}
      style={[styles.nearbyBranchRow, !canOpen && styles.nearbyBranchRowDisabled]}
      accessibilityRole="button"
      accessibilityLabel={`${branch.businessName}, ${branch.branchName}`}
      accessibilityHint={canOpen ? 'Открыть запись в этот бизнес' : 'Бизнес пока недоступен для записи'}
    >
      <View style={styles.nearbyBranchMain}>
        <Text style={styles.nearbyBranchName}>{branch.businessName}</Text>
        <Text style={styles.nearbyBranchMeta} numberOfLines={2}>
          {branch.branchName}
          {branch.address ? ` · ${branch.address}` : ''}
        </Text>
      </View>
      <Text style={styles.nearbyBranchDistance}>{branch.distanceKm.toFixed(1)} км</Text>
    </MotionPressable>
  );
}

function getNearbyStatusCopy(status: NearbyStatus, error: unknown): string {
  switch (status) {
    case 'locating':
      return 'Запрашиваем доступ и определяем ваше местоположение...';
    case 'loading':
      return 'Ищем ближайшие филиалы по вашему местоположению...';
    case 'denied':
      return 'Доступ к геолокации не разрешён. Можно попробовать ещё раз или выбрать бизнес из списка ниже.';
    case 'unavailable':
      return 'Геолокация сейчас недоступна на устройстве. Проверьте Location в настройках или выберите бизнес из списка ниже.';
    case 'error':
      return error instanceof Error && error.message
        ? 'Не удалось загрузить ближайшие филиалы. Проверьте интернет и попробуйте снова.'
        : 'Не удалось загрузить ближайшие филиалы. Попробуйте снова.';
    case 'ready':
      return 'Нашли филиалы рядом с вами. Выберите подходящий вариант или продолжайте смотреть общий список.';
    case 'idle':
    default:
      return 'Разрешите геолокацию, и мы покажем ближайшие филиалы с учётом расстояния.';
  }
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
      accessibilityRole="button"
      accessibilityLabel={`Категория ${label}`}
      accessibilityState={{ selected: isActive }}
      accessibilityHint="Фильтрует список бизнесов по категории"
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
  error,
  search,
  selectedCategory,
  onRetry,
  onClearFilters,
  onOpenBusiness,
}: BusinessListSectionProps) {
  if (isLoading && !isRefreshing) {
    return <LoadingSpinner message="Загружаем данные..." />;
  }

  if (error && businesses.length === 0) {
    return (
      <EmptyState
        icon="alert-circle"
        title="Не удалось загрузить список"
        message="Проверьте интернет-соединение и попробуйте снова."
        action={<Button title="Повторить" onPress={onRetry} variant="outline" fullWidth />}
      />
    );
  }

  if (businesses.length === 0) {
    const hasFilters = Boolean(search || selectedCategory);

    return (
      <EmptyState
        icon="search"
        title={hasFilters ? 'Ничего не найдено' : 'Пока нет доступных бизнесов'}
        message={
          hasFilters
            ? 'Измените параметры поиска или сбросьте фильтры.'
            : 'Список появится здесь, как только будут доступные варианты.'
        }
        action={
          hasFilters ? (
            <Button
              title="Сбросить фильтры"
              onPress={onClearFilters}
              variant="outline"
              fullWidth
            />
          ) : undefined
        }
      />
    );
  }

  return (
    <View style={styles.businessList}>
      {businesses.map((business) => (
        <BusinessCard
          key={business.id}
          business={business}
          onOpenBusiness={onOpenBusiness}
        />
      ))}
    </View>
  );
}

export const BusinessCard = React.memo(function BusinessCard({
  business,
  onOpenBusiness,
}: BusinessCardProps) {
  const openBusiness = () => onOpenBusiness(business.slug, business.name);
  const businessAccessibilityLabel = buildBusinessAccessibilityLabel(business);

  return (
    <MotionPressable
      onPress={openBusiness}
      scale="firm"
      accessibilityRole="button"
      accessibilityLabel={businessAccessibilityLabel}
      accessibilityHint="Открывает запись в этот бизнес"
    >
      <Card style={styles.businessCard} variant="muted">
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
              accessible={false}
              importantForAccessibility="no"
            />
            <Text style={styles.businessAddress}>{business.address}</Text>
          </View>
        ) : null}

        {business.phones?.length ? (
          <View style={styles.businessInfo}>
            <Ionicons
              name="call-outline"
              size={16}
              color={colors.text.secondary}
              accessible={false}
              importantForAccessibility="no"
            />
            <Text style={styles.businessPhone}>{formatPhone(business.phones[0])}</Text>
          </View>
        ) : null}

        {business.categories?.length ? (
          <View style={styles.businessCategories}>
            {business.categories.map((category) => (
              <View key={category} style={styles.businessCategoryTag}>
                <Text style={styles.businessCategoryText}>{category}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.businessFooter}>
          <Button
            title="Записаться"
            onPress={openBusiness}
            trailingIcon={<Ionicons name="arrow-forward" size={16} color={colors.text.light} />}
            fullWidth
            accessibilityLabel={`Записаться в ${business.name}`}
          />
        </View>
      </Card>
    </MotionPressable>
  );
});

function buildBusinessAccessibilityLabel(business: HomeBusiness): string {
  const parts = [business.name];

  if (business.categories?.length) {
    parts.push(`Категории: ${business.categories.join(', ')}`);
  }

  if (business.address) {
    parts.push(`Адрес: ${business.address}`);
  }

  if (business.phones?.length) {
    parts.push(`Телефон: ${formatPhone(business.phones[0])}`);
  }

  if (typeof business.rating_score === 'number') {
    parts.push(`Рейтинг: ${business.rating_score.toFixed(1)}`);
  }

  return parts.join('. ');
}
