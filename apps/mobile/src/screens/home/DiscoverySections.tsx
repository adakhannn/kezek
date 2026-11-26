import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ChipGroup from '../../components/ui/ChipGroup';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import ListRow from '../../components/ui/ListRow';
import MotionPressable from '../../components/ui/MotionPressable';
import RatingBadge from '../../components/ui/RatingBadge';
import Section from '../../components/ui/Section';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { colors } from '../../constants/colors';
import { layout } from '../../constants/theme';
import { translatePlural, useLanguage, type MobileI18nKey, type Translate } from '../../i18n';
import { formatRatingDisplayValue } from '@shared-client/rating';
import { formatPhone } from '../../utils/format';

import { categoryLabel } from './homeDiscovery';
import { styles } from './homeScreenStyles';
import type { HomeBusiness, NearbyBranch, NearbyStatus } from './types';

type CategoriesSectionProps = {
  categories: string[];
  /** slug -> name; a slug without a name is shown as it is. */
  categoryLabels?: Record<string, string>;
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
  onBookBusiness?: (slug: string, previewName?: string) => void;
  categoryLabels?: Record<string, string>;
};

type BusinessCardProps = {
  business: HomeBusiness;
  /** The card opens the business page (C2). */
  onOpenBusiness: (slug: string, previewName?: string) => void;
  /** Its button goes straight to the booking flow; without it the button opens the page too. */
  onBookBusiness?: (slug: string, previewName?: string) => void;
  categoryLabels?: Record<string, string>;
};

type NearbySectionProps = {
  branches: NearbyBranch[];
  status: NearbyStatus;
  error: unknown;
  onRequestNearby: () => void;
  onOpenMap: () => void;
  onOpenBusiness: (slug: string, previewName?: string) => void;
};

/** "All" has no slug; the chip key must not collide with a real category. */
const ALL_CATEGORIES = '__all__';

/** The category filter: one line of chips that scrolls sideways (never ragged rows). */
export function CategoriesSection({
  categories,
  categoryLabels = NO_LABELS,
  selectedCategory,
  onSelectCategory,
}: CategoriesSectionProps) {
  const { t } = useLanguage();

  if (categories.length === 0) {
    return null;
  }

  const options = [
    { key: ALL_CATEGORIES, label: t('booking.home.categoryAll') },
    ...categories.map((category) => ({ key: category, label: categoryLabel(categoryLabels, category) })),
  ];

  return (
    <Section title={t('booking.home.categoriesTitle')}>
      <ChipGroup
        options={options}
        value={selectedCategory ?? ALL_CATEGORIES}
        onChange={(key) => onSelectCategory(key === ALL_CATEGORIES ? null : key)}
        accessibilityLabel={t('booking.home.categoryHint')}
        testID="home-categories"
      />
    </Section>
  );
}

/** Branches near the person: a status line, the found rows, "find" and the map. */
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
  const statusCopy = t(getNearbyStatusKey(status, error));

  return (
    <Section title={t('booking.home.nearbyTitle')}>
      <Card variant="plain" padding="md" style={styles.nearbyCard}>
        <View style={styles.nearbyStatus}>
          <View style={[styles.nearbyIcon, hasError && styles.nearbyIconWarning]}>
            <Ionicons
              name={hasError ? 'alert-circle-outline' : 'navigate-outline'}
              size={18}
              color={hasError ? colors.tone.warning.fg : colors.tone.accent.fg}
              accessible={false}
              importantForAccessibility="no"
            />
          </View>
          <Text style={styles.nearbyText}>
            {status === 'ready' && branches.length === 0 ? t('booking.home.nearbyEmpty') : statusCopy}
          </Text>
        </View>

        {hasBranches ? (
          <View style={styles.nearbyRows}>
            {branches.map((branch) => (
              <NearbyBranchRow
                key={branch.id}
                branch={branch}
                onOpenBusiness={onOpenBusiness}
              />
            ))}
          </View>
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
          variant="secondary"
          loading={isBusy}
          fullWidth
          leadingIcon={isBusy ? undefined : <Ionicons name="locate-outline" size={18} color={colors.text.primary} />}
          accessibilityLabel={t('booking.home.nearbyFindLabel')}
          accessibilityHint={t('booking.home.nearbyFindHint')}
        />
        <ListRow
          icon="map-outline"
          title={t('booking.home.openMap')}
          onPress={onOpenMap}
          accessibilityHint={t('booking.home.openMapHint')}
          style={styles.nearbyMapRow}
        />
      </Card>
    </Section>
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
      style={[styles.nearbyRow, !canOpen && styles.nearbyRowDisabled]}
      accessibilityRole="button"
      accessibilityLabel={`${branch.businessName}, ${branch.branchName}`}
      accessibilityHint={t(canOpen ? 'booking.home.nearbyOpenHint' : 'booking.home.nearbyUnavailableHint')}
    >
      <View style={styles.nearbyRowMain}>
        <Text style={styles.nearbyRowName} numberOfLines={1}>{branch.businessName}</Text>
        <Text style={styles.nearbyRowMeta} numberOfLines={2}>
          {branch.branchName}
          {branch.address ? ` · ${branch.address}` : ''}
        </Text>
      </View>
      <Text style={styles.nearbyDistance}>
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

/** The list states: skeleton cards, a failure with retry, or an empty result with an action. */
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
  onBookBusiness,
  categoryLabels,
}: BusinessListSectionProps) {
  const { t } = useLanguage();

  if (isLoading && !isRefreshing) {
    return (
      <View style={{ gap: layout.itemGap }} accessibilityLabel={t('booking.home.loadingData')}>
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </View>
    );
  }

  if (error && businesses.length === 0) {
    return (
      <ErrorState
        title={t('booking.home.loadErrorTitle')}
        message={t('booking.checkConnection')}
        retryLabel={t('booking.retry')}
        onRetry={onRetry}
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
    <View style={{ gap: layout.itemGap }}>
      {businesses.map((business) => (
        <BusinessCard
          key={business.id}
          business={business}
          onOpenBusiness={onOpenBusiness}
          onBookBusiness={onBookBusiness}
          categoryLabels={categoryLabels}
        />
      ))}
    </View>
  );
}

/**
 * One business in a list: initials tile, name, rating and promotions, address and phone, the
 * category tags and the booking button. The whole card opens the business page.
 */
export const BusinessCard = React.memo(function BusinessCard({
  business,
  onOpenBusiness,
  onBookBusiness,
  categoryLabels = NO_LABELS,
}: BusinessCardProps) {
  const { t } = useLanguage();
  const openBusiness = () => onOpenBusiness(business.slug, business.name);
  const bookBusiness = () => (onBookBusiness ?? onOpenBusiness)(business.slug, business.name);
  const businessAccessibilityLabel = buildBusinessAccessibilityLabel(business, t, categoryLabels);

  return (
    <MotionPressable
      onPress={openBusiness}
      scale="firm"
      accessibilityRole="button"
      accessibilityLabel={businessAccessibilityLabel}
      accessibilityHint={t('discovery.home.openBusinessHint')}
    >
      <Card variant="plain" padding="md" style={styles.businessCard}>
        <View style={styles.businessTop}>
          <Avatar name={business.name} size={48} />
          <View style={styles.businessMain}>
            <Text style={styles.businessName} numberOfLines={2}>{business.name}</Text>
            <View style={styles.businessRating}>
              <RatingBadge rating={business.rating_score ?? null} size="small" />
              {business.promotions_count ? (
                <Badge
                  icon="pricetag-outline"
                  tone="accent"
                  label={translatePlural(t, 'discovery.home.promotions', business.promotions_count)}
                />
              ) : null}
            </View>
          </View>
        </View>

        {business.address || business.phones?.length ? (
          <View style={styles.businessMetaGroup}>
            {business.address ? (
              <View style={styles.businessMetaRow}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={colors.text.secondary}
                  accessible={false}
                  importantForAccessibility="no"
                />
                <Text style={styles.businessMeta} numberOfLines={2}>{business.address}</Text>
              </View>
            ) : null}
            {business.phones?.length ? (
              <View style={styles.businessMetaRow}>
                <Ionicons
                  name="call-outline"
                  size={14}
                  color={colors.text.secondary}
                  accessible={false}
                  importantForAccessibility="no"
                />
                <Text style={styles.businessMeta}>{formatPhone(business.phones[0])}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {business.categories?.length ? (
          <View style={styles.businessTags}>
            {business.categories.map((category) => (
              <Badge key={category} label={categoryLabel(categoryLabels, category)} />
            ))}
          </View>
        ) : null}

        <Button
          title={t('booking.book')}
          onPress={bookBusiness}
          variant="secondary"
          size="sm"
          trailingIcon={<Ionicons name="arrow-forward" size={16} color={colors.tone.accent.fg} />}
          fullWidth
          accessibilityLabel={t('booking.home.bookAt', { name: business.name })}
          accessibilityHint={t('discovery.home.bookHint')}
        />
      </Card>
    </MotionPressable>
  );
});

const NO_LABELS: Record<string, string> = {};

function buildBusinessAccessibilityLabel(
  business: HomeBusiness,
  t: Translate,
  categoryLabels: Record<string, string> = NO_LABELS,
): string {
  const parts = [business.name];

  if (business.categories?.length) {
    parts.push(t('booking.home.a11y.categories', {
      list: business.categories.map((category) => categoryLabel(categoryLabels, category)).join(', '),
    }));
  }

  if (business.address) {
    parts.push(t('booking.home.a11y.address', { address: business.address }));
  }

  if (business.phones?.length) {
    parts.push(t('booking.home.a11y.phone', { phone: formatPhone(business.phones[0]) }));
  }

  if (typeof business.rating_score === 'number') {
    parts.push(t('booking.home.a11y.rating', { rating: formatRatingDisplayValue(business.rating_score) }));
  }

  return parts.join('. ');
}
