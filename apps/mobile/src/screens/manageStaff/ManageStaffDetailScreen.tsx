import { Fragment, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import Avatar from '../../components/ui/Avatar';
import Badge, { StatusPill } from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import ListRow, { KeyValueRow, ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { SkeletonCard, SkeletonList } from '../../components/ui/Skeleton';
import KitStatTile, { StatGrid } from '../../components/ui/StatTile';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import type { ManageStaffRouteParams, RootStackParamList } from '../../navigation/types';
import { fetchStaffDetail } from './api';
import { staffErrorMessage } from './errors';
import { staffQueryKeys } from './queryKeys';
import { staffFormFromCard } from './staffForm';
import { StaffDangerZone, StaffProfileForm, StaffServicesEditor, StaffTransferPanel } from './StaffDetailSections';
import { ui } from './ui';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ManageStaffDetail'>;

/** The rating advice of the website's card, by score band. */
export function ratingAdviceKey(score: number | null): MobileI18nKey {
    if (score === null) return 'manageStaff.staff.rating.advice.noScore';
    if (score < 60) return 'manageStaff.staff.rating.advice.low';
    if (score < 80) return 'manageStaff.staff.rating.advice.medium';
    return 'manageStaff.staff.rating.advice.high';
}

const FACTORS: { key: 'reviews' | 'productivity' | 'loyalty' | 'discipline'; label: MobileI18nKey; color: string }[] = [
    { key: 'reviews', label: 'manageStaff.dashboard.rating.factor.reviews', color: colors.tone.success.fg },
    { key: 'productivity', label: 'manageStaff.dashboard.rating.factor.productivity', color: colors.tone.accent.fg },
    { key: 'loyalty', label: 'manageStaff.dashboard.rating.factor.loyalty', color: colors.tone.info.fg },
    { key: 'discipline', label: 'manageStaff.dashboard.rating.factor.discipline', color: colors.tone.danger.fg },
];

/** /dashboard/staff/[id]: the card, its pay terms, services, rating, reviews and dangerous actions. */
export default function ManageStaffDetailScreen() {
    const navigation = useNavigation<Navigation>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageStaffDetail'>>();
    const { t } = useLanguage();
    const { showToast } = useToast();
    const tz = resolveBusinessTimeZone(params.tz);
    const [refreshing, setRefreshing] = useState(false);

    const detail = useQuery({
        queryKey: staffQueryKeys.detail(params.bizId, params.staffId),
        queryFn: () => fetchStaffDetail(params.bizId, params.staffId),
    });
    const formInitial = useMemo(() => (detail.data ? staffFormFromCard(detail.data.staff) : null), [detail.data]);

    if (detail.isLoading) {
        return (
            <Screen testID="manage-staff-detail-loading">
                <SkeletonCard lines={3} />
                <SkeletonList rows={3} avatar={false} />
            </Screen>
        );
    }
    if (!detail.data) {
        return (
            <Screen>
                <ErrorState
                    title={t('manageStaff.loadError')}
                    message={staffErrorMessage(detail.error, t('staff.checkConnection'), t)}
                    onRetry={() => void detail.refetch()}
                />
            </Screen>
        );
    }

    const { staff, branches, reviews, ratingScore, ratingWeights, explicitScheduling } = detail.data;
    const activeBranches = branches.filter((branch) => branch.is_active);
    const currentBranch = branches.find((branch) => branch.id === staff.branch_id);
    const masterPercent = Number(staff.percent_master ?? 60);
    const salonPercent = Number(staff.percent_salon ?? 40);
    const reviewAverage = reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;
    const latestReviewDate = reviews[0]?.created_at ?? null;
    const routeParams: ManageStaffRouteParams = {
        bizId: params.bizId, bizName: params.bizName, tz: params.tz, staffId: staff.id, staffName: staff.full_name,
    };

    const refresh = async () => {
        setRefreshing(true);
        try { await detail.refetch(); } finally { setRefreshing(false); }
    };

    return (
        <Screen keyboard refreshing={refreshing} onRefresh={refresh} testID="manage-staff-detail">
            {/* Hero: the person, the branch, the state and the contacts (the header says "Сотрудник"). */}
            <Card variant="accent" padding="md" style={styles.hero}>
                <View style={styles.heroTop}>
                    <Avatar name={staff.full_name} uri={staff.avatar_url} size={56} />
                    <View style={styles.heroText}>
                        <Text style={styles.heroName} accessibilityRole="header" numberOfLines={2}>{staff.full_name}</Text>
                        <Text style={styles.heroMeta} numberOfLines={1}>
                            {currentBranch
                                ? `${t('manageStaff.staff.detail.branch.current')} ${currentBranch.name}`
                                : t('manageStaff.staff.detail.branch.missing')}
                        </Text>
                        <View style={styles.heroBadges}>
                            <StatusPill
                                label={t(staff.is_active ? 'manageStaff.staff.detail.status.active' : 'manageStaff.staff.detail.status.inactive')}
                                tone={staff.is_active ? 'success' : 'neutral'}
                            />
                            {ratingWeights ? (
                                <Badge
                                    icon="star"
                                    label={`${t('manageStaff.staff.rating.title.short')}: ${ratingScore !== null ? ratingScore.toFixed(1) : '—'}`}
                                    tone="warning"
                                />
                            ) : null}
                        </View>
                    </View>
                </View>
                <View style={styles.heroFacts}>
                    <KeyValueRow label={t('manageStaff.staff.detail.contact.phone')} value={staff.phone || '—'} />
                    <KeyValueRow label={t('manageStaff.staff.detail.contact.email')} value={staff.email || '—'} />
                    <KeyValueRow
                        label={t('manageStaff.staff.detail.finance.share')}
                        value={`${masterPercent}% / ${salonPercent}%${staff.hourly_rate ? ` · ${staff.hourly_rate}/h` : ''}`}
                    />
                </View>
            </Card>

            <ListGroup inset>
                <ListRow
                    icon="calendar-outline"
                    title={t('manageStaff.staff.detail.nav.schedule')}
                    subtitle={`${t('manageStaff.staff.detail.transfer.note')} ${t('manageStaff.staff.detail.transfer.scheduleLink')}`}
                    onPress={() => navigation.navigate('ManageStaffSchedule', routeParams)}
                />
                <ListRow
                    icon="time-outline"
                    iconTone="info"
                    title={t('manageStaff.staff.detail.nav.slots')}
                    onPress={() => navigation.navigate('ManageStaffSlots', routeParams)}
                />
                <ListRow
                    icon="wallet-outline"
                    iconTone="success"
                    title={t('manageStaff.staff.detail.nav.finance')}
                    onPress={() => navigation.navigate('ManageStaffFinance', routeParams)}
                />
            </ListGroup>

            <StatGrid>
                <KitStatTile
                    icon="chatbubble-ellipses-outline"
                    label={t('manageStaff.staff.detail.overview.reviews')}
                    value={String(reviews.length)}
                    hint={reviewAverage !== null
                        ? `${t('manageStaff.staff.detail.overview.avgRating')}: ${reviewAverage.toFixed(1)}`
                        : t('manageStaff.staff.detail.reviews.empty')}
                />
                <KitStatTile
                    icon="pie-chart-outline"
                    label={t('manageStaff.staff.detail.overview.finance')}
                    value={`${masterPercent}%`}
                    hint={`${t('manageStaff.staff.detail.overview.masterShare')} · ${salonPercent}% ${t('manageStaff.staff.detail.overview.salonShare')}`}
                />
                <KitStatTile
                    icon="pulse-outline"
                    label={t('manageStaff.staff.detail.overview.latestSignal')}
                    value={latestReviewDate ? formatInTimeZone(new Date(latestReviewDate), tz, 'dd.MM.yyyy HH:mm') : t('manageStaff.staff.detail.overview.noSignals')}
                />
            </StatGrid>

            {activeBranches.length > 1 ? (
                <StaffTransferPanel
                    bizId={params.bizId}
                    staffId={staff.id}
                    currentBranchId={staff.branch_id}
                    branches={activeBranches.map((branch) => ({ id: branch.id, name: branch.name }))}
                    explicitScheduling={explicitScheduling}
                />
            ) : (
                <Text style={[ui.muted, styles.singleBranch]}>{t('manageStaff.staff.detail.transfer.singleBranch')}</Text>
            )}

            <Section title={t('manageStaff.staff.detail.sections.mainInfo.title')}>
                {formInitial ? <StaffProfileForm bizId={params.bizId} initial={formInitial} onSaved={() => navigation.goBack()} /> : null}
            </Section>

            <Section title={t('manageStaff.staff.detail.sections.competencies.title')} caption={t('manageStaff.form.servicesHint')}>
                <StaffServicesEditor bizId={params.bizId} staffId={staff.id} branchId={staff.branch_id} />
            </Section>

            {ratingWeights ? (
                <Section
                    title={t('manageStaff.staff.rating.title')}
                    caption={t('manageStaff.staff.rating.subtitle', { days: String(ratingWeights.windowDays) })}
                >
                    <Card variant="plain" padding="md" style={styles.rating}>
                        <View style={styles.score}>
                            <Text style={styles.scoreLabel}>{t('manageStaff.staff.rating.scoreLabel')}</Text>
                            <Text style={styles.scoreValue}>{ratingScore !== null ? ratingScore.toFixed(1) : '—'}</Text>
                            <Text style={ui.muted}>{t(ratingAdviceKey(ratingScore))}</Text>
                        </View>
                        <View style={ui.hairline} />
                        {FACTORS.map((factor) => {
                            const value = ratingWeights[factor.key];
                            return (
                                <View key={factor.key} style={styles.factor} accessible accessibilityLabel={`${t(factor.label)}: ${value}%`}>
                                    <View style={styles.factorRow}>
                                        <Text style={styles.factorLabel}>{t(factor.label)}</Text>
                                        <Text style={styles.factorValue}>{value}%</Text>
                                    </View>
                                    <View style={styles.track}>
                                        <View style={[styles.bar, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: factor.color }]} />
                                    </View>
                                </View>
                            );
                        })}
                        <Text style={ui.muted}>{`${t('manageStaff.staff.rating.window')}: ${ratingWeights.windowDays}`}</Text>
                    </Card>
                </Section>
            ) : null}

            <Section
                title={t('manageStaff.staff.detail.sections.reviews.title')}
                right={<Badge label={`${t('manageStaff.staff.detail.reviews.count')} ${reviews.length}`} />}
            >
                {reviews.length === 0 ? (
                    <EmptyState icon="chatbubble-ellipses-outline" compact title={t('manageStaff.staff.detail.reviews.empty')} />
                ) : (
                    <Card variant="plain" padding="none" style={styles.reviews}>
                        {reviews.map((review, index) => (
                            <Fragment key={review.id}>
                                {index > 0 ? <View style={ui.hairline} /> : null}
                                <View style={styles.review}>
                                    <View style={styles.reviewTop}>
                                        <Badge icon="star" label={`${review.rating}/5`} tone="warning" />
                                        <Text style={ui.muted}>{formatInTimeZone(new Date(review.start_at), tz, 'dd.MM.yyyy HH:mm')}</Text>
                                    </View>
                                    <Text style={ui.strong}>{review.service_name || t('manageStaff.staff.detail.reviews.serviceMissing')}</Text>
                                    <Text style={ui.muted}>{review.client_name || review.client_phone || t('manageStaff.staff.detail.reviews.client')}</Text>
                                    {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
                                </View>
                            </Fragment>
                        ))}
                    </Card>
                )}
            </Section>

            <Section title={t('manageStaff.staff.danger.title')}>
                <StaffDangerZone
                    bizId={params.bizId}
                    staffId={staff.id}
                    allowPermanentDelete={!explicitScheduling}
                    onDone={(action) => {
                        showToast(t(action === 'dismiss' ? 'manageStaff.staff.dismissed' : 'manageStaff.deleted'), 'success');
                        navigation.goBack();
                    }}
                />
            </Section>
        </Screen>
    );
}

const styles = StyleSheet.create({
    hero: { gap: space.md },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    heroText: { flex: 1, minWidth: 0, gap: space.xs },
    heroName: { ...typeScale.title, color: colors.text.primary },
    heroMeta: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary },
    heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    heroFacts: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
        paddingTop: space.xs,
    },
    singleBranch: { textAlign: 'center', marginTop: -space.sm },
    rating: { gap: space.md },
    score: { gap: space.xs },
    scoreLabel: { ...typeScale.overline, color: colors.text.tertiary },
    scoreValue: { ...typeScale.display, color: colors.text.primary },
    factor: { gap: space.xs },
    factorRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
    factorLabel: { ...typeScale.callout, fontWeight: '400', color: colors.text.primary, flex: 1 },
    factorValue: { ...typeScale.callout, color: colors.text.primary },
    track: { height: 6, borderRadius: 3, backgroundColor: colors.fill.track, overflow: 'hidden' },
    bar: { height: 6, borderRadius: 3 },
    reviews: { paddingHorizontal: space.lg },
    review: { paddingVertical: space.md, gap: space.xs },
    reviewTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    reviewComment: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary, marginTop: space.xs, padding: space.md, borderRadius: radii.md, backgroundColor: colors.fill.input },
});
