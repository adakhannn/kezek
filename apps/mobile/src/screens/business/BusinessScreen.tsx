import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, type ReactNode } from 'react';
import { Linking, RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatRatingDisplayValue } from '@shared-client/rating';

import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import MotionPressable from '../../components/ui/MotionPressable';
import RatingBadge from '../../components/ui/RatingBadge';
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
            <View style={styles.centered}>
                {previewName ? <Text style={styles.previewName}>{previewName}</Text> : null}
                <LoadingSpinner message={t('discovery.business.loading')} />
            </View>
        );
    }

    if (query.isError) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('discovery.business.errorTitle')}
                message={t('discovery.business.errorMessage')}
                action={<Button title={t('discovery.business.retry')} onPress={() => void query.refetch()} variant="outline" fullWidth />}
            />
        );
    }

    if (!query.data) {
        return (
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
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="business-page"
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
        >
            <Card style={styles.hero}>
                <View style={styles.badges}>
                    <Badge label={t('discovery.business.verified')} tone="accent" />
                    {promotions.length > 0 ? (
                        <Badge label={translatePlural(t, 'discovery.home.promotions', promotions.length)} tone="success" />
                    ) : null}
                    <Badge
                        label={hasBranches ? t('discovery.business.bookable') : t('discovery.business.noBranchesBadge')}
                        tone={hasBranches ? 'info' : 'neutral'}
                    />
                </View>
                <Text style={styles.title} accessibilityRole="header">
                    {business.name}
                </Text>
                <View style={styles.metaRow}>
                    <View
                        accessible={typeof business.rating_score === 'number'}
                        accessibilityLabel={
                            typeof business.rating_score === 'number'
                                ? t('booking.home.a11y.rating', { rating: formatRatingDisplayValue(business.rating_score) })
                                : undefined
                        }
                    >
                        <RatingBadge rating={business.rating_score ?? null} />
                    </View>
                    {business.address ? <Text style={styles.metaText}>{business.address}</Text> : null}
                </View>
                <ContactActions contacts={{ ...businessContacts, phone: businessPhone }} />
                {hasBranches ? (
                    <Button
                        title={t('discovery.business.book')}
                        onPress={onBook}
                        fullWidth
                        style={styles.bookButton}
                        trailingIcon={<Ionicons name="arrow-forward" size={16} color={colors.text.light} />}
                        accessibilityHint={t('discovery.business.bookHint')}
                    />
                ) : (
                    <Text style={styles.notice} accessibilityRole="text">
                        {t('discovery.business.noBranches')}
                    </Text>
                )}
            </Card>

            <Section title={t('discovery.business.about')}>
                <View style={styles.metrics}>
                    <Metric value={branches.length} label={t('discovery.business.metrics.branches')} />
                    <Metric value={services.length} label={t('discovery.business.metrics.services')} />
                    <Metric value={staff.length} label={t('discovery.business.metrics.staff')} />
                    <Metric value={promotions.length} label={t('discovery.business.metrics.promotions')} />
                </View>
            </Section>

            {promotions.length > 0 ? (
                <Section title={t('discovery.business.promotions')} subtitle={t('discovery.business.promotionsDescription')} testID="business-promotions">
                    {promotions.map((promotion) => {
                        const description = promotionDescription(promotion, locale);
                        const validTo = formatPromotionDate(promotion.valid_to);
                        const branch = branchName(promotion.branch_id);
                        return (
                            <View key={promotion.id} style={styles.promotion}>
                                <View style={styles.promotionIcon}>
                                    <Text style={styles.promotionIconText}>%</Text>
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
                    {onOpenPromotions ? (
                        <Button
                            title={t('parity.promotions.openAll')}
                            onPress={onOpenPromotions}
                            variant="outline"
                            size="sm"
                            fullWidth
                            accessibilityHint={t('parity.promotions.openAllHint')}
                        />
                    ) : null}
                </Section>
            ) : null}

            {hasBranches ? (
                <Section title={t('discovery.business.branches')} count={branches.length} testID="business-branches">
                    {branches.map((branch) => (
                        <BranchCard key={branch.id} data={data} branch={branch} onOpenMap={onOpenMap} />
                    ))}
                </Section>
            ) : null}

            {services.length > 0 ? (
                <Section title={t('discovery.business.services')} count={services.length} testID="business-services">
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
                </Section>
            ) : null}

            {staff.length > 0 ? (
                <Section title={t('discovery.business.staff')} count={staff.length} testID="business-staff">
                    {staff.slice(0, STAFF_PREVIEW).map((person) => {
                        const name = formatStaffName(person.full_name, locale);
                        const branch = branchName(person.branch_id);
                        return (
                            <View key={person.id} style={styles.row}>
                                <Avatar name={name} uri={person.avatar_url} size={44} />
                                <View style={styles.flex}>
                                    <Text style={styles.itemTitle}>{name}</Text>
                                    {branch ? <Text style={styles.itemMeta}>{branch}</Text> : null}
                                </View>
                                <RatingBadge rating={person.rating_score ?? null} size="small" />
                            </View>
                        );
                    })}
                    {staff.length > STAFF_PREVIEW ? (
                        <Text style={styles.more}>{t('discovery.business.more', { count: staff.length - STAFF_PREVIEW })}</Text>
                    ) : null}
                </Section>
            ) : null}

            {hasBranches ? (
                <Button
                    title={t('discovery.business.book')}
                    onPress={onBook}
                    fullWidth
                    size="lg"
                    accessibilityHint={t('discovery.business.bookHint')}
                />
            ) : null}
        </ScrollView>
    );
}

function BranchCard({ data, branch, onOpenMap }: { data: BusinessPageData; branch: BusinessPageBranch; onOpenMap: () => void }) {
    const { t, locale } = useLanguage();
    const links = sanitizeDirectoryLinks(branch.directory_links);
    const linkKeys = DIRECTORY_LINK_KEYS.filter((key) => links[key]);

    return (
        <View style={styles.branch}>
            <View style={styles.row}>
                <View style={styles.flex}>
                    <Text style={styles.itemTitle}>{formatStaffName(branch.name, locale)}</Text>
                    {branch.address ? <Text style={styles.itemText}>{branch.address}</Text> : null}
                </View>
                <RatingBadge rating={branch.rating_score ?? null} size="small" />
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
        </View>
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
            <Ionicons name={icon} size={14} color={colors.accent.indigo} accessible={false} importantForAccessibility="no" />
            <Text style={styles.chipText}>{label}</Text>
        </MotionPressable>
    );
}

function Section({
    title,
    subtitle,
    count,
    testID,
    children,
}: {
    title: string;
    subtitle?: string;
    count?: number;
    testID?: string;
    children: ReactNode;
}) {
    return (
        <Card style={styles.section} testID={testID}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                    {title}
                </Text>
                {typeof count === 'number' ? <Text style={styles.count}>{count}</Text> : null}
            </View>
            {subtitle ? <Text style={styles.itemText}>{subtitle}</Text> : null}
            <View style={styles.sectionBody}>{children}</View>
        </Card>
    );
}

function Metric({ value, label }: { value: number; label: string }) {
    return (
        <View style={styles.metric} accessible accessibilityLabel={`${value} ${label}`}>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.itemMeta}>{label}</Text>
        </View>
    );
}

function Badge({ label, tone }: { label: string; tone: 'accent' | 'success' | 'info' | 'neutral' }) {
    return (
        <View style={[styles.badge, styles[`badge_${tone}`]]}>
            <Text style={styles.badgeText}>{label}</Text>
        </View>
    );
}
