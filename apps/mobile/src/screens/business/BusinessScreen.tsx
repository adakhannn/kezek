import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { formatRatingDisplayValue } from '@shared-client/rating';

import ActionBar from '../../components/ui/ActionBar';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { ListGroup } from '../../components/ui/ListRow';
import MotionPressable from '../../components/ui/MotionPressable';
import RatingBadge from '../../components/ui/RatingBadge';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import { SkeletonCard, SkeletonList } from '../../components/ui/Skeleton';
import StatTile, { StatGrid } from '../../components/ui/StatTile';
import { colors } from '../../constants/colors';
import { translatePlural, useLanguage, type MobileI18nKey } from '../../i18n';
import { trackMobileEvent } from '../../lib/analytics';
import type { RootStackParamList } from '../../navigation/types';
import { formatPhone } from '../../utils/format';
import { formatStaffName, getServiceName } from '../../utils/i18n';
import {
    DIRECTORY_LINK_KEYS,
    emailHref,
    formatPromotionDate,
    formatServicePrice,
    phoneHref,
    promotionDescription,
    promotionTitle,
    resolvePublicContacts,
    sanitizeDirectoryLinks,
    whatsAppHref,
    type BusinessPageBranch,
    type BusinessPageData,
    type DirectoryLinkKey,
    type PublicContacts,
} from './businessPageModel';
import { styles } from './businessScreenStyles';
import { useBusinessPageData } from './useBusinessPageData';

type BusinessRoute = RouteProp<RootStackParamList, 'Business'>;
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

const SERVICES_PREVIEW = 8;
const STAFF_PREVIEW = 9;

const DIRECTORY_LINK_LABELS: Record<DirectoryLinkKey, MobileI18nKey> = {
    instagram: 'discovery.business.link.instagram',
    two_gis: 'discovery.business.link.twoGis',
    google_maps: 'discovery.business.link.googleMaps',
    yandex_maps: 'discovery.business.link.yandexMaps',
};

/**
 * The public business page (C2, C7), before the booking steps, as the web /b/<slug>: rating,
 * contacts, branches with their directory links, services with prices, the team and the active
 * promotions. "Записаться" opens the existing booking flow for this slug. Needs no account.
 */
export default function BusinessScreen() {
    const route = useRoute<BusinessRoute>();
    const navigation = useNavigation<RootNavigation>();
    const { slug, previewName } = route.params ?? { slug: '' };
    const { t } = useLanguage();
    const query = useBusinessPageData(slug);
    const bizId = query.data?.business.id;

    useEffect(() => {
        if (bizId) {
            trackMobileEvent({ eventType: 'business_page_view', bizId });
        }
    }, [bizId]);

    if (query.isLoading) {
        return (
            <Screen testID="business-page-loading">
                {previewName ? <ScreenIntro>{previewName}</ScreenIntro> : null}
                <View style={styles.loading} accessibilityLabel={t('discovery.business.loading')}>
                    <SkeletonCard lines={3} />
                    <SkeletonCard lines={1} />
                    <SkeletonList rows={3} avatar={false} />
                </View>
            </Screen>
        );
    }

    if (query.isError) {
        return (
            <Screen>
                <ErrorState
                    title={t('discovery.business.errorTitle')}
                    message={t('discovery.business.errorMessage')}
                    retryLabel={t('discovery.business.retry')}
                    onRetry={() => void query.refetch()}
                />
            </Screen>
        );
    }

    if (!query.data) {
        return (
            <Screen>
                <EmptyState
                    icon="search"
                    title={t('discovery.business.notFoundTitle')}
                    message={t('discovery.business.notFoundMessage')}
                    action={
                        <Button
                            title={t('discovery.business.backHome')}
                            onPress={() => navigation.navigate('Main', { screen: 'Home' })}
                            variant="outline"
                            fullWidth
                        />
                    }
                />
            </Screen>
        );
    }

    const openBooking = () =>
        navigation.navigate('Booking', { slug: query.data!.business.slug, previewName: query.data!.business.name });

    return (
        <BusinessPageContent
            data={query.data}
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            onBook={openBooking}
            onOpenMap={() => navigation.navigate('Map')}
            onOpenPromotions={() =>
                navigation.navigate('Promotions', { slug: query.data!.business.slug, previewName: query.data!.business.name })}
        />
    );
}

export function BusinessPageContent({
    data,
    refreshing = false,
    onRefresh,
    onBook,
    onOpenMap,
    onOpenPromotions,
}: {
    data: BusinessPageData;
    refreshing?: boolean;
    onRefresh?: () => void;
    onBook: () => void;
    onOpenMap: () => void;
    /** The website's /b/<slug>/promotions page: every promotion by branch with its dates. */
    onOpenPromotions?: () => void;
}) {
    const { t, locale } = useLanguage();
    const { business, branches, services, staff, promotions } = data;
    const hasBranches = branches.length > 0;
    const branchName = (branchId: string) => {
        const branch = branches.find((item) => item.id === branchId);
        return branch ? formatStaffName(branch.name, locale) : null;
    };
    const businessContacts = resolvePublicContacts(business);
    const businessPhone = businessContacts.phone ?? business.phones?.[0] ?? null;

    return (
        <Screen
            testID="business-page"
            refreshing={refreshing}
            onRefresh={onRefresh}
            footer={hasBranches ? (
                <ActionBar
                    primary={{
                        title: t('discovery.business.book'),
                        onPress: onBook,
                        accessibilityHint: t('discovery.business.bookHint'),
                    }}
                />
            ) : undefined}
        >
            <Card variant="accent" padding="md" style={styles.hero}>
                <View style={styles.heroTop}>
                    <Avatar name={business.name} size={56} />
                    <View style={styles.heroText}>
                        <Text style={styles.title} accessibilityRole="header" numberOfLines={3}>
                            {business.name}
                        </Text>
                        <View
                            accessible={typeof business.rating_score === 'number'}
                            accessibilityLabel={
                                typeof business.rating_score === 'number'
                                    ? t('booking.home.a11y.rating', { rating: formatRatingDisplayValue(business.rating_score) })
                                    : undefined
                            }
                            style={styles.ratingWrap}
                        >
                            <RatingBadge rating={business.rating_score ?? null} size="small" />
                        </View>
                    </View>
                </View>
                <View style={styles.badges}>
                    <Badge icon="shield-checkmark-outline" label={t('discovery.business.verified')} tone="accent" />
                    {promotions.length > 0 ? (
                        <Badge icon="pricetag-outline" label={translatePlural(t, 'discovery.home.promotions', promotions.length)} tone="success" />
                    ) : null}
                    <Badge
                        icon={hasBranches ? 'calendar-outline' : 'pause-circle-outline'}
                        label={hasBranches ? t('discovery.business.bookable') : t('discovery.business.noBranchesBadge')}
                        tone={hasBranches ? 'info' : 'neutral'}
                    />
                </View>
                {business.address ? (
                    <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={16} color={colors.text.secondary} accessible={false} importantForAccessibility="no" />
                        <Text style={styles.metaText}>{business.address}</Text>
                    </View>
                ) : null}
                <ContactActions contacts={{ ...businessContacts, phone: businessPhone }} />
                {hasBranches ? null : (
                    <Text style={styles.notice} accessibilityRole="text">
                        {t('discovery.business.noBranches')}
                    </Text>
                )}
            </Card>

            <StatGrid columns={2}>
                <StatTile icon="storefront-outline" value={String(branches.length)} label={t('discovery.business.branches')} />
                <StatTile icon="cut-outline" value={String(services.length)} label={t('discovery.business.services')} />
                <StatTile icon="people-outline" value={String(staff.length)} label={t('discovery.business.staff')} />
                <StatTile
                    icon="pricetag-outline"
                    value={String(promotions.length)}
                    label={t('discovery.business.promotions')}
                    tone={promotions.length > 0 ? 'success' : undefined}
                />
            </StatGrid>

            {promotions.length > 0 ? (
                <Section
                    title={t('discovery.business.promotions')}
                    caption={t('discovery.business.promotionsDescription')}
                    testID="business-promotions"
                    right={onOpenPromotions ? (
                        <SectionLink
                            label={t('parity.promotions.openAll')}
                            hint={t('parity.promotions.openAllHint')}
                            onPress={onOpenPromotions}
                        />
                    ) : undefined}
                >
                    <ListGroup inset>
                        {promotions.map((promotion) => {
                            const description = promotionDescription(promotion, locale);
                            const validTo = formatPromotionDate(promotion.valid_to);
                            const branch = branchName(promotion.branch_id);
                            return (
                                <View key={promotion.id} style={styles.row}>
                                    <View style={styles.promotionIcon}>
                                        <Ionicons name="pricetag-outline" size={18} color={colors.tone.success.fg} />
                                    </View>
                                    <View style={styles.flex}>
                                        <Text style={styles.itemTitle}>{promotionTitle(promotion, t)}</Text>
                                        {description ? <Text style={styles.itemText}>{description}</Text> : null}
                                        {branch || validTo ? (
                                            <Text style={styles.itemMeta}>
                                                {[branch, validTo ? t('discovery.business.promotionValidTo', { date: validTo }) : null]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                            );
                        })}
                    </ListGroup>
                </Section>
            ) : null}

            {hasBranches ? (
                <Section
                    title={t('discovery.business.branches')}
                    right={<Badge label={String(branches.length)} />}
                    testID="business-branches"
                >
                    {branches.map((branch) => (
                        <BranchCard key={branch.id} data={data} branch={branch} onOpenMap={onOpenMap} />
                    ))}
                </Section>
            ) : null}

            {services.length > 0 ? (
                <Section
                    title={t('discovery.business.services')}
                    right={<Badge label={String(services.length)} />}
                    testID="business-services"
                >
                    <ListGroup>
                        {services.slice(0, SERVICES_PREVIEW).map((service) => {
                            const branch = branchName(service.branch_id);
                            return (
                                <View key={service.id} style={styles.row}>
                                    <View style={styles.flex}>
                                        <Text style={styles.itemTitle}>{getServiceName(service, locale)}</Text>
                                        {branch ? <Text style={styles.itemMeta}>{branch}</Text> : null}
                                    </View>
                                    <View style={styles.rowEnd}>
                                        <Text style={styles.price}>{formatServicePrice(service, t)}</Text>
                                        <Text style={styles.itemMeta}>
                                            {t('discovery.business.duration', { minutes: service.duration_min })}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                        {services.length > SERVICES_PREVIEW ? (
                            <Text style={styles.more}>{t('discovery.business.more', { count: services.length - SERVICES_PREVIEW })}</Text>
                        ) : null}
                    </ListGroup>
                </Section>
            ) : null}

            {staff.length > 0 ? (
                <Section
                    title={t('discovery.business.staff')}
                    right={<Badge label={String(staff.length)} />}
                    testID="business-staff"
                >
                    <ListGroup inset>
                        {staff.slice(0, STAFF_PREVIEW).map((person) => {
                            const name = formatStaffName(person.full_name, locale);
                            const branch = branchName(person.branch_id);
                            return (
                                <View key={person.id} style={styles.row}>
                                    <Avatar name={name} uri={person.avatar_url} size={40} />
                                    <View style={styles.stack}>
                                        <Text style={styles.itemTitle} numberOfLines={2}>{name}</Text>
                                        {branch ? <Text style={styles.itemMeta} numberOfLines={1}>{branch}</Text> : null}
                                        <RatingBadge rating={person.rating_score ?? null} size="small" />
                                    </View>
                                </View>
                            );
                        })}
                        {staff.length > STAFF_PREVIEW ? (
                            <Text style={styles.more}>{t('discovery.business.more', { count: staff.length - STAFF_PREVIEW })}</Text>
                        ) : null}
                    </ListGroup>
                </Section>
            ) : null}
        </Screen>
    );
}

function SectionLink({ label, hint, onPress }: { label: string; hint?: string; onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={hint}
            style={({ pressed }) => [styles.sectionLink, pressed ? styles.pressed : null]}
        >
            <Text style={styles.sectionLinkText}>{label}</Text>
        </Pressable>
    );
}

function BranchCard({ data, branch, onOpenMap }: { data: BusinessPageData; branch: BusinessPageBranch; onOpenMap: () => void }) {
    const { t, locale } = useLanguage();
    const links = sanitizeDirectoryLinks(branch.directory_links);
    const linkKeys = DIRECTORY_LINK_KEYS.filter((key) => links[key]);

    return (
        <Card variant="plain" padding="md" style={styles.branch}>
            <View style={styles.stack}>
                <Text style={styles.itemTitle}>{formatStaffName(branch.name, locale)}</Text>
                <RatingBadge rating={branch.rating_score ?? null} size="small" />
                {branch.address ? (
                    <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={16} color={colors.text.secondary} accessible={false} importantForAccessibility="no" />
                        <Text style={styles.metaText}>{branch.address}</Text>
                    </View>
                ) : null}
            </View>
            <ContactActions contacts={resolvePublicContacts(data.business, branch)} />
            <View style={styles.chips}>
                <LinkChip label={t('discovery.business.openMap')} icon="map-outline" onPress={onOpenMap} />
                {linkKeys.map((key) => (
                    <LinkChip
                        key={key}
                        label={t(DIRECTORY_LINK_LABELS[key])}
                        icon="open-outline"
                        onPress={() => void Linking.openURL(links[key]!)}
                    />
                ))}
            </View>
        </Card>
    );
}

function ContactActions({ contacts }: { contacts: PublicContacts }) {
    const { t } = useLanguage();
    const actions: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; href: string }[] = [];

    if (contacts.phone) actions.push({ key: 'phone', label: formatPhone(contacts.phone), icon: 'call-outline', href: phoneHref(contacts.phone) });
    if (contacts.whatsapp) actions.push({ key: 'whatsapp', label: t('discovery.business.contact.whatsapp'), icon: 'logo-whatsapp', href: whatsAppHref(contacts.whatsapp) });
    if (contacts.email) actions.push({ key: 'email', label: contacts.email, icon: 'mail-outline', href: emailHref(contacts.email) });
    if (contacts.website) actions.push({ key: 'website', label: t('discovery.business.contact.website'), icon: 'globe-outline', href: contacts.website });

    if (actions.length === 0) return null;

    return (
        <View style={styles.chips}>
            {actions.map((action) => (
                <LinkChip key={action.key} label={action.label} icon={action.icon} onPress={() => void Linking.openURL(action.href)} />
            ))}
        </View>
    );
}

function LinkChip({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
    return (
        <MotionPressable onPress={onPress} style={styles.chip} accessibilityRole="link" accessibilityLabel={label}>
            <Ionicons name={icon} size={16} color={colors.tone.accent.fg} accessible={false} importantForAccessibility="no" />
            <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
        </MotionPressable>
    );
}
