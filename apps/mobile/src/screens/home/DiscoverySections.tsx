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
import { useLanguage, type MobileI18nKey, type Translate } from '../../i18n';
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
  const { t } = useLanguage();

  if (categories.length === 0) {
    return null;
  }

  return (
    <View style={styles.categoriesContainer}>
      <Text style={styles.categoriesLabel}>{t('booking.home.categoriesTitle')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
        <CategoryChip label={t('booking.home.categoryAll')} isActive={!selectedCategory} onPress={() => onSelectCategory(null)} />
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
  const { t } = useLanguage();
  const isBusy = status === 'locating' || status === 'loading';
  const hasError = status === 'denied' || status === 'unavailable' || status === 'error';
  const hasBranches = status === 'ready' && branches.length > 0;
  const errorCopy = t(getNearbyStatusKey(status, error));

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
          <Text style={styles.nearbyFallbackTitle}>{t('booking.home.nearbyTitle')}</Text>
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
            <Text style={styles.nearbyFallbackHint}>{t('booking.home.nearbyEmpty')}</Text>
          ) : null}

          <Button
            title={t(
              isBusy
                ? 'booking.home.nearbySearching'
                : status === 'idle'
                  ? 'booking.home.nearbyFind'
                  : 'booking.home.nearbyRefresh',
            )}
            onPress={onRequestNearby}
            variant={hasBranches ? 'outline' : 'secondary'}
            size="sm"
            loading={isBusy}
            fullWidth
            style={styles.nearbyAction}
            accessibilityLabel={t('booking.home.nearbyFindLabel')}
            accessibilityHint={t('booking.home.nearbyFindHint')}
          />
          <Button
            title={t('booking.home.openMap')}
            onPress={onOpenMap}
            variant="outline"
            size="sm"
            fullWidth
            style={styles.nearbyMapAction}
            leadingIcon={<Ionicons name="map-outline" size={16} color={colors.text.primary} />}
            accessibilityLabel={t('booking.home.openMap')}
            accessibilityHint={t('booking.home.openMapHint')}
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
  const { t } = useLanguage();
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
      accessibilityHint={t(canOpen ? 'booking.home.nearbyOpenHint' : 'booking.home.nearbyUnavailableHint')}
    >
      <View style={styles.nearbyBranchMain}>
        <Text style={styles.nearbyBranchName}>{branch.businessName}</Text>
        <Text style={styles.nearbyBranchMeta} numberOfLines={2}>
          {branch.branchName}
          {branch.address ? ` · ${branch.address}` : ''}
        </Text>
      </View>
      <Text style={styles.nearbyBranchDistance}>
        {t('booking.home.distanceKm', { distance: branch.distanceKm.toFixed(1) })}
      </Text>
    </MotionPressable>
  );
}

function getNearbyStatusKey(status: NearbyStatus, error: unknown): MobileI18nKey {
  switch (status) {
    case 'locating':
      return 'booking.home.nearby.locating';
    case 'loading':
      return 'booking.home.nearby.loading';
    case 'denied':
      return 'booking.home.nearby.denied';
    case 'unavailable':
      return 'booking.home.nearby.unavailable';
    case 'error':
      return error instanceof Error && error.message
        ? 'booking.home.nearby.errorNetwork'
        : 'booking.home.nearby.error';
    case 'ready':
      return 'booking.home.nearby.ready';
    case 'idle':
    default:
      return 'booking.home.nearby.idle';
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
  const { t } = useLanguage();

  return (
    <MotionPressable
      style={[styles.categoryChip, isActive && styles.categoryChipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('booking.home.categoryLabel', { label })}
      accessibilityState={{ selected: isActive }}
      accessibilityHint={t('booking.home.categoryHint')}
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
  const { t } = useLanguage();

  if (isLoading && !isRefreshing) {
    return <LoadingSpinner message={t('booking.home.loadingData')} />;
  }

  if (error && businesses.length === 0) {
    return (
      <EmptyState
        icon="alert-circle"
        title={t('booking.home.loadErrorTitle')}
        message={t('booking.checkConnection')}
        action={<Button title={t('booking.retry')} onPress={onRetry} variant="outline" fullWidth />}
      />
    );
  }

  if (businesses.length === 0) {
    const hasFilters = Boolean(search || selectedCategory);

    return (
      <EmptyState
        icon="search"
        title={t(hasFilters ? 'booking.home.emptyFilteredTitle' : 'booking.home.emptyTitle')}
        message={t(hasFilters ? 'booking.home.emptyFilteredMessage' : 'booking.home.emptyMessage')}
        action={
          hasFilters ? (
            <Button
              title={t('booking.home.resetFilters')}
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
  const { t } = useLanguage();
  const openBusiness = () => onOpenBusiness(business.slug, business.name);
  const businessAccessibilityLabel = buildBusinessAccessibilityLabel(business, t);

  return (
    <MotionPressable
      onPress={openBusiness}
      scale="firm"
      accessibilityRole="button"
      accessibilityLabel={businessAccessibilityLabel}
      accessibilityHint={t('booking.home.openBusinessHint')}
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
            title={t('booking.book')}
            onPress={openBusiness}
            trailingIcon={<Ionicons name="arrow-forward" size={16} color={colors.text.light} />}
            fullWidth
            accessibilityLabel={t('booking.home.bookAt', { name: business.name })}
          />
        </View>
      </Card>
    </MotionPressable>
  );
});

function buildBusinessAccessibilityLabel(business: HomeBusiness, t: Translate): string {
  const parts = [business.name];

  if (business.categories?.length) {
    parts.push(t('booking.home.a11y.categories', { list: business.categories.join(', ') }));
  }

  if (business.address) {
    parts.push(t('booking.home.a11y.address', { address: business.address }));
  }

  if (business.phones?.length) {
    parts.push(t('booking.home.a11y.phone', { phone: formatPhone(business.phones[0]) }));
  }

  if (typeof business.rating_score === 'number') {
    parts.push(t('booking.home.a11y.rating', { rating: business.rating_score.toFixed(1) }));
  }

  return parts.join('. ');
}
