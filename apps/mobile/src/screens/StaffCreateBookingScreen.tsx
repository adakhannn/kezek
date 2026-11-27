import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import ActionBar from '../components/ui/ActionBar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ChipGroup from '../components/ui/ChipGroup';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import FormField, { FieldGroup } from '../components/ui/FormField';
import Screen from '../components/ui/Screen';
import { CheckboxRow } from '../components/ui/SelectionRow';
import { SkeletonBlock, SkeletonCard } from '../components/ui/Skeleton';
import { colors } from '../constants/colors';
import { space, typeScale } from '../constants/theme';
import { useToast } from '../contexts/ToastContext';
import { useCurrentStaff } from '../hooks/useCurrentStaff';
import { useLanguage } from '../i18n';
import { getErrorMessage } from '../lib/errors';
import type { RootStackParamList } from '../navigation/types';
import { formatTime } from '../utils/format';
import { formatStaffName, getServiceName } from '../utils/i18n';
import { getValidationError } from '../utils/validation';
import { useBookingStep4Dates } from './booking/useBookingStep4Dates';
import {
    bookableSlots,
    buildInternalBookingInput,
    createInternalBooking,
    fetchFreeSlots,
    fetchStaffBookingOptions,
    pickedServices,
    servicesOfBranch,
} from './staff/staffCreateBooking';

/**
 * The website's /staff/bookings "Создать запись": the master books a client who calls or comes in,
 * with one service or a complex of several, in a free slot of their own schedule.
 */
export default function StaffCreateBookingScreen() {
    const { t, locale } = useLanguage();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { staffInfo, isLoading: staffLoading } = useCurrentStaff();
    const bizId = staffInfo?.biz_id ?? '';
    const staffId = staffInfo?.id ?? '';
    const tz = staffInfo?.business?.tz ?? null;
    const { dates, formatDateLabel } = useBookingStep4Dates(tz);

    const [branchId, setBranchId] = useState(staffInfo?.branch?.id ?? '');
    const [serviceIds, setServiceIds] = useState<string[]>([]);
    const [day, setDay] = useState(dates[0]);
    const [slotStart, setSlotStart] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const phoneRef = useRef<TextInput>(null);

    useEffect(() => {
        if (!branchId && staffInfo?.branch?.id) setBranchId(staffInfo.branch.id);
    }, [branchId, staffInfo?.branch?.id]);

    const optionsQuery = useQuery({
        queryKey: ['staff-booking-options', bizId, staffId],
        queryFn: () => fetchStaffBookingOptions(bizId, staffId),
        enabled: !!bizId && !!staffId,
    });
    const branchServices = useMemo(
        () => servicesOfBranch(optionsQuery.data?.services ?? [], branchId),
        [optionsQuery.data?.services, branchId],
    );
    const selectedServices = useMemo(() => pickedServices(branchServices, serviceIds), [branchServices, serviceIds]);

    const slotsQuery = useQuery({
        queryKey: ['staff-booking-slots', bizId, branchId, staffId, day, serviceIds.join(',')],
        queryFn: async () => bookableSlots(
            await fetchFreeSlots({ bizId, branchId, staffId, day, services: selectedServices }),
            staffId,
            branchId,
        ),
        enabled: !!bizId && !!branchId && !!staffId && selectedServices.length > 0,
    });
    const slots = useMemo(() => slotsQuery.data ?? [], [slotsQuery.data]);

    // The first free start is chosen, and kept while it stays free (web CreateBookingForm).
    useEffect(() => {
        setSlotStart((previous) => (previous && slots.some((slot) => slot.start_at === previous) ? previous : slots[0]?.start_at ?? ''));
    }, [slots]);

    const create = useMutation({
        mutationFn: () => createInternalBooking(buildInternalBookingInput({
            bizId,
            branchId,
            staffId,
            startAt: slotStart,
            services: selectedServices,
            clientName,
            clientPhone,
        })),
        onSuccess: (bookingId) => {
            showToast(t('parity.staffBooking.success', { id: bookingId.slice(0, 8) }), 'success');
            void queryClient.invalidateQueries({ queryKey: ['staff-bookings'] });
            void queryClient.invalidateQueries({ queryKey: ['staff-booking-slots'] });
            navigation.goBack();
        },
        onError: (error: unknown) => setFormError(getErrorMessage(error, t('parity.staffBooking.errors.generic'), t)),
    });

    const submit = () => {
        setFormError(null);
        if (!selectedServices.length) return setFormError(t('parity.staffBooking.errors.selectService'));
        if (!slotStart) return setFormError(t('parity.staffBooking.errors.noSlots'));
        const nameError = getValidationError('name', clientName, t);
        if (nameError) return setFormError(nameError);
        const phoneError = getValidationError('phone', clientPhone, t);
        if (phoneError) return setFormError(phoneError);
        create.mutate();
    };

    if (staffLoading || optionsQuery.isLoading) {
        return (
            <Screen testID="staff-create-booking-loading">
                <SkeletonBlock height={44} />
                <SkeletonCard lines={3} />
                <SkeletonCard lines={2} />
            </Screen>
        );
    }
    if (!staffInfo) {
        return (
            <Screen>
                <EmptyState icon="briefcase-outline" title={t('staff.notStaff')} message={t('staff.workspace.notStaffMessage')} />
            </Screen>
        );
    }
    if (optionsQuery.isError) {
        return (
            <Screen>
                <ErrorState title={t('parity.staffBooking.loadError')} onRetry={() => void optionsQuery.refetch()} />
            </Screen>
        );
    }

    const branches = optionsQuery.data?.branches ?? [];
    const toggleService = (id: string) => {
        setFormError(null);
        setServiceIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    };
    const canCreate = !!branchId && selectedServices.length > 0 && !!slotStart && !!clientName.trim() && !!clientPhone.trim();

    return (
        <Screen
            keyboard
            testID="staff-create-booking-screen"
            footer={(
                <ActionBar
                    primary={{
                        title: create.isPending ? t('parity.staffBooking.creating') : t('parity.staffBooking.create'),
                        onPress: submit,
                        loading: create.isPending,
                        disabled: !canCreate || create.isPending,
                    }}
                >
                    {formError ? <FeedbackBanner variant="danger" message={formError} compact /> : null}
                </ActionBar>
            )}
        >
            <FieldGroup title={t('parity.staffBooking.branch')}>
                <ChipGroup
                    options={branches.map((branch) => ({ key: branch.id, label: formatStaffName(branch.name, locale) }))}
                    value={branchId || null}
                    onChange={(id) => {
                        setBranchId(id);
                        setServiceIds([]);
                    }}
                    accessibilityLabel={t('parity.staffBooking.branch')}
                    style={styles.groupBody}
                />
            </FieldGroup>

            <FieldGroup
                title={t('parity.staffBooking.service')}
                caption={branchId && branchServices.length > 0 ? t('parity.staffBooking.serviceHint') : undefined}
            >
                <View style={styles.groupBody}>
                    {!branchId ? (
                        <Text style={styles.hint}>{t('parity.staffBooking.selectBranchFirst')}</Text>
                    ) : branchServices.length === 0 ? (
                        <EmptyState compact icon="cut-outline" title={t('parity.staffBooking.noServicesInBranch')} />
                    ) : (
                        <Card variant="plain" padding="none" style={styles.list}>
                            {branchServices.map((service) => (
                                <CheckboxRow
                                    key={service.id}
                                    label={getServiceName(service, locale)}
                                    hint={t('parity.staffServices.duration', { minutes: String(service.duration_min) })}
                                    checked={serviceIds.includes(service.id)}
                                    onChange={() => toggleService(service.id)}
                                    testID={`staff-booking-service-${service.id}`}
                                />
                            ))}
                        </Card>
                    )}
                </View>
            </FieldGroup>

            <FieldGroup title={t('parity.staffBooking.date')}>
                <ChipGroup
                    options={dates.map((date) => {
                        const label = formatDateLabel(date);
                        return { key: date, label: `${label.weekday}, ${label.dayMonth}` };
                    })}
                    value={day}
                    onChange={setDay}
                    accessibilityLabel={t('parity.staffBooking.date')}
                    style={styles.groupBody}
                />
            </FieldGroup>

            {selectedServices.length > 0 ? (
                <FieldGroup title={t('parity.staffBooking.time')}>
                    <View style={styles.groupBody}>
                        {slotsQuery.isLoading ? (
                            <View style={styles.slotSkeleton} accessibilityLabel={t('parity.staffBooking.loadingSlots')}>
                                {[0, 1, 2, 3].map((index) => <SkeletonBlock key={index} width={72} height={44} radius={22} />)}
                            </View>
                        ) : slotsQuery.isError ? (
                            <View style={styles.inline}>
                                <Text style={[styles.hint, styles.danger]}>{t('parity.staffBooking.slotsLoadError')}</Text>
                                <Button title={t('staff.retry')} onPress={() => void slotsQuery.refetch()} variant="ghost" size="sm" />
                            </View>
                        ) : slots.length === 0 ? (
                            <Text style={styles.hint}>{t('parity.staffBooking.noSlots')}</Text>
                        ) : (
                            <ChipGroup
                                layout="wrap"
                                options={slots.map((slot) => ({ key: slot.start_at, label: formatTime(slot.start_at, tz) }))}
                                value={slotStart || null}
                                onChange={setSlotStart}
                                accessibilityLabel={t('parity.staffBooking.time')}
                            />
                        )}
                    </View>
                </FieldGroup>
            ) : null}

            <FieldGroup title={t('parity.staffBooking.client')} caption={t('parity.staffBooking.clientDescription')}>
                <FormField
                    label={t('parity.staffBooking.clientName')}
                    required
                    placeholder={t('parity.staffBooking.clientNamePlaceholder')}
                    value={clientName}
                    onChangeText={setClientName}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => phoneRef.current?.focus()}
                    testID="staff-booking-client-name"
                />
                <FormField
                    ref={phoneRef}
                    label={t('parity.staffBooking.clientPhone')}
                    required
                    placeholder="+996555123456"
                    hint={t('parity.staffBooking.phoneFormat')}
                    value={clientPhone}
                    onChangeText={setClientPhone}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    testID="staff-booking-client-phone"
                />
            </FieldGroup>
        </Screen>
    );
}

const styles = StyleSheet.create({
    // FieldGroup pulls its body up by one field gap (FormField margin); non-field content gives it back.
    groupBody: { marginBottom: space.lg },
    list: { paddingHorizontal: space.lg },
    hint: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary },
    danger: { color: colors.tone.danger.fg },
    inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
    slotSkeleton: { flexDirection: 'row', gap: space.sm },
});
