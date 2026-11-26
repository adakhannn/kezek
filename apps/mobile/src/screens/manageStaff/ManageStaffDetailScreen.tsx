import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import type { ManageStaffRouteParams, RootStackParamList } from '../../navigation/types';
import { fetchStaffDetail } from './api';
import { staffErrorMessage } from './errors';
import { staffQueryKeys } from './queryKeys';
import { staffFormFromCard } from './staffForm';
import { StaffDangerZone, StaffProfileForm, StaffServicesEditor, StaffTransferPanel } from './StaffDetailSections';
import { Badge, SectionTitle, StatTile, ui } from './ui';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ManageStaffDetail'>;

/** The rating advice of the website's card, by score band. */
export function ratingAdviceKey(score: number | null): MobileI18nKey {
    if (score === null) return 'manageStaff.staff.rating.advice.noScore';
    if (score < 60) return 'manageStaff.staff.rating.advice.low';
    if (score < 80) return 'manageStaff.staff.rating.advice.medium';
    return 'manageStaff.staff.rating.advice.high';
}

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

    if (detail.isLoading) return <LoadingSpinner message={t('common.loading')} />;
    if (!detail.data) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('manageStaff.loadError')}
                message={staffErrorMessage(detail.error, t('staff.checkConnection'), t)}
                action={<Button title={t('staff.retry')} onPress={() => void detail.refetch()} variant="outline" fullWidth />}
            />
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
        <ScrollView
            style={ui.container}
            contentContainerStyle={ui.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
            testID="manage-staff-detail"
        >
            <Card style={styles.hero}>
                <Text style={styles.heroTitle} accessibilityRole="header">{staff.full_name}</Text>
                <Text style={styles.heroText}>
                    {currentBranch
                        ? `${t('manageStaff.staff.detail.branch.current')} ${currentBranch.name}`
                        : t('manageStaff.staff.detail.branch.missing')}
                </Text>
                <View style={ui.wrap}>
                    <Badge
                        label={t(staff.is_active ? 'manageStaff.staff.detail.status.active' : 'manageStaff.staff.detail.status.inactive')}
                        tone={staff.is_active ? 'success' : 'muted'}
                    />
                    {ratingWeights ? (
                        <Badge label={`${t('manageStaff.staff.rating.title.short')}: ${ratingScore !== null ? ratingScore.toFixed(1) : '—'}`} tone="warning" />
                    ) : null}
                </View>
                <View style={styles.navGrid}>
                    <Button title={t('manageStaff.staff.detail.nav.schedule')} onPress={() => navigation.navigate('ManageStaffSchedule', routeParams)} variant="secondary" style={styles.navButton} />
                    <Button title={t('manageStaff.staff.detail.nav.slots')} onPress={() => navigation.navigate('ManageStaffSlots', routeParams)} variant="secondary" style={styles.navButton} />
                    <Button title={t('manageStaff.staff.detail.nav.finance')} onPress={() => navigation.navigate('ManageStaffFinance', routeParams)} variant="secondary" style={styles.navButton} />
                </View>
                {activeBranches.length > 1 ? (
                    <StaffTransferPanel
                        bizId={params.bizId}
                        staffId={staff.id}
                        currentBranchId={staff.branch_id}
                        branches={activeBranches.map((branch) => ({ id: branch.id, name: branch.name }))}
                        explicitScheduling={explicitScheduling}
                    />
                ) : (
                    <Text style={ui.muted}>{t('manageStaff.staff.detail.transfer.singleBranch')}</Text>
                )}
                <View style={ui.wrap}>
                    <StatTile label={t('manageStaff.staff.detail.contact.email')} value={staff.email || '—'} style={styles.contact} />
                    <StatTile label={t('manageStaff.staff.detail.contact.phone')} value={staff.phone || '—'} style={styles.contact} />
                    <StatTile
                        label={t('manageStaff.staff.detail.finance.share')}
                        value={`${masterPercent}% / ${salonPercent}%${staff.hourly_rate ? ` • ${staff.hourly_rate}/h` : ''}`}
                        style={styles.contact}
                    />
                </View>
            </Card>

            <View style={ui.wrap}>
                <StatTile
                    label={t('manageStaff.staff.detail.overview.reviews')}
                    value={String(reviews.length)}
                    hint={reviewAverage !== null
                        ? `${t('manageStaff.staff.detail.overview.avgRating')}: ${reviewAverage.toFixed(1)}`
                        : t('manageStaff.staff.detail.reviews.empty')}
                />
                <StatTile
                    label={t('manageStaff.staff.detail.overview.finance')}
                    value={`${masterPercent}%`}
                    hint={`${t('manageStaff.staff.detail.overview.masterShare')} • ${salonPercent}% ${t('manageStaff.staff.detail.overview.salonShare')}`}
                />
                <StatTile
                    label={t('manageStaff.staff.detail.overview.latestSignal')}
                    value={latestReviewDate ? formatInTimeZone(new Date(latestReviewDate), tz, 'dd.MM.yyyy HH:mm') : t('manageStaff.staff.detail.overview.noSignals')}
                    hint={t('manageStaff.staff.detail.overview.signalHint')}
                />
            </View>

            <Card>
                <SectionTitle title={t('manageStaff.staff.detail.sections.mainInfo.title')} description={t('manageStaff.staff.detail.sections.mainInfo.desc')} />
                {formInitial ? <StaffProfileForm bizId={params.bizId} initial={formInitial} onSaved={() => navigation.goBack()} /> : null}
            </Card>

            <Card>
                <SectionTitle title={t('manageStaff.staff.detail.sections.competencies.title')} description={t('manageStaff.staff.detail.sections.competencies.desc')} />
                <StaffServicesEditor bizId={params.bizId} staffId={staff.id} branchId={staff.branch_id} />
            </Card>

            {ratingWeights ? (
                <Card style={styles.rating}>
                    <SectionTitle
                        title={t('manageStaff.staff.rating.title')}
                        description={t('manageStaff.staff.rating.subtitle', { days: String(ratingWeights.windowDays) })}
                        right={<Badge label={`${t('manageStaff.staff.rating.window')}: ${ratingWeights.windowDays}`} tone="warning" />}
                    />
                    <Text style={ui.muted}>{t(ratingAdviceKey(ratingScore))}</Text>
                    <View style={[ui.wrap, styles.factors]}>
                        <Badge label={`${t('manageStaff.dashboard.rating.factor.reviews')}: ${ratingWeights.reviews}%`} tone="success" />
                        <Badge label={`${t('manageStaff.dashboard.rating.factor.productivity')}: ${ratingWeights.productivity}%`} tone="accent" />
                        <Badge label={`${t('manageStaff.dashboard.rating.factor.loyalty')}: ${ratingWeights.loyalty}%`} tone="muted" />
                        <Badge label={`${t('manageStaff.dashboard.rating.factor.discipline')}: ${ratingWeights.discipline}%`} tone="danger" />
                    </View>
                    <StatTile label={t('manageStaff.staff.rating.scoreLabel')} value={ratingScore !== null ? ratingScore.toFixed(1) : '—'} />
                </Card>
            ) : null}

            <Card>
                <SectionTitle
                    title={t('manageStaff.staff.detail.sections.reviews.title')}
                    description={t('manageStaff.staff.detail.sections.reviews.desc')}
                    right={<Badge label={`${reviews.length} ${t('manageStaff.staff.detail.reviews.count')}`} />}
                />
                {reviews.length === 0 ? (
                    <Text style={ui.muted}>{t('manageStaff.staff.detail.reviews.empty')}</Text>
                ) : (
                    <View style={ui.gap}>
                        {reviews.map((review) => (
                            <View key={review.id} style={styles.review}>
                                <View style={ui.row}>
                                    <Badge label={`${review.rating}/5`} tone="warning" />
                                    <Text style={ui.muted}>{formatInTimeZone(new Date(review.start_at), tz, 'dd.MM.yyyy HH:mm')}</Text>
                                </View>
                                <Text style={styles.reviewService}>{review.service_name || t('manageStaff.staff.detail.reviews.serviceMissing')}</Text>
                                <Text style={ui.muted}>{review.client_name || review.client_phone || t('manageStaff.staff.detail.reviews.client')}</Text>
                                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
                            </View>
                        ))}
                    </View>
                )}
            </Card>

            <Card variant="outlined">
                <Text style={ui.muted}>
                    {t('manageStaff.staff.detail.transfer.note')} {t('manageStaff.staff.detail.transfer.scheduleLink')}.
                </Text>
                <Button
                    title={t('manageStaff.staff.detail.nav.schedule')}
                    onPress={() => navigation.navigate('ManageStaffSchedule', routeParams)}
                    variant="ghost"
                    size="sm"
                />
            </Card>

            <StaffDangerZone
                bizId={params.bizId}
                staffId={staff.id}
                allowPermanentDelete={!explicitScheduling}
                onDone={(action) => {
                    showToast(t(action === 'dismiss' ? 'manageStaff.staff.dismissed' : 'manageStaff.deleted'), 'success');
                    navigation.goBack();
                }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    hero: { gap: colors.layout.space3, borderColor: colors.accent.primary, borderWidth: 1 },
    heroTitle: { fontSize: 24, fontWeight: '700', color: colors.text.primary },
    heroText: { fontSize: 15, color: colors.text.secondary },
    navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: colors.layout.space2 },
    navButton: { flexGrow: 1, flexBasis: '30%' },
    contact: { flexBasis: '100%' },
    rating: { gap: colors.layout.space3 },
    factors: { marginVertical: colors.layout.space2 },
    review: {
        padding: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.elevated,
        gap: colors.layout.space1,
    },
    reviewService: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
    reviewComment: { fontSize: 14, color: colors.text.secondary, marginTop: colors.layout.space2 },
});
