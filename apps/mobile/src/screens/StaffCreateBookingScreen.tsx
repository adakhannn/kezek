import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import MotionPressable from '../components/ui/MotionPressable';
import { MIN_TOUCH_TARGET } from '../constants/accessibility';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
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
        queryKey: ['staff-booking-options', bizId],
        queryFn: () => fetchStaffBookingOptions(bizId),
        enabled: !!bizId,
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

    if (staffLoading || optionsQuery.isLoading) return <LoadingSpinner message={t('common.loading')} />;
    if (!staffInfo) return <EmptyState icon="briefcase" title={t('staff.notStaff')} message={t('staff.workspace.notStaffMessage')} />;
    if (optionsQuery.isError) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('parity.staffBooking.loadError')}
                message={t('staff.checkConnection')}
                action={<Button title={t('staff.retry')} onPress={() => void optionsQuery.refetch()} variant="outline" fullWidth />}
            />
        );
    }

    const branches = optionsQuery.data?.branches ?? [];
    const toggleService = (id: string) => {
        setFormError(null);
        setServiceIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    };
    const canCreate = !!branchId && selectedServices.length > 0 && !!slotStart && !!clientName.trim() && !!clientPhone.trim();

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                automaticallyAdjustKeyboardInsets
                testID="staff-create-booking-screen"
            >
                <Card style={styles.card}>
                    <Text style={styles.label}>{t('parity.staffBooking.branch')}</Text>
                    <View style={styles.chips} accessibilityRole="radiogroup">
                        {branches.map((branch) => {
                            const selected = branch.id === branchId;
                            return (
                                <Chip
                                    key={branch.id}
                                    label={formatStaffName(branch.name, locale)}
                                    selected={selected}
                                    role="radio"
                                    onPress={() => {
                                        setBranchId(branch.id);
                                        setServiceIds([]);
                                    }}
                                />
                            );
                        })}
                    </View>

                    <Text style={styles.label}>{t('parity.staffBooking.service')}</Text>
                    {!branchId ? (
                        <Text style={styles.hint}>{t('parity.staffBooking.selectBranchFirst')}</Text>
                    ) : branchServices.length === 0 ? (
                        <Text style={styles.hint}>{t('parity.staffBooking.noServicesInBranch')}</Text>
                    ) : (
                        <>
                            <Text style={styles.hint}>{t('parity.staffBooking.serviceHint')}</Text>
                            {branchServices.map((service) => {
                                const checked = serviceIds.includes(service.id);
                                return (
                                    <MotionPressable
                                        key={service.id}
                                        onPress={() => toggleService(service.id)}
                                        style={[styles.option, checked ? styles.optionSelected : null]}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{ checked }}
                                        accessibilityLabel={getServiceName(service, locale)}
                                        testID={`staff-booking-service-${service.id}`}
                                    >
                                        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? colors.accent.indigo : colors.text.tertiary} />
                                        <Text style={styles.optionText}>
                                            {getServiceName(service, locale)}{' '}
                                            <Text style={styles.hint}>{t('parity.staffBooking.serviceDuration', { minutes: String(service.duration_min) })}</Text>
                                        </Text>
                                    </MotionPressable>
                                );
                            })}
                        </>
                    )}

                    <Text style={styles.label}>{t('parity.staffBooking.date')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                        {dates.map((date) => {
                            const label = formatDateLabel(date);
                            return (
                                <Chip
                                    key={date}
                                    label={`${label.weekday} ${label.day} ${label.month}`}
                                    selected={date === day}
                                    role="radio"
                                    onPress={() => setDay(date)}
                                />
                            );
                        })}
                    </ScrollView>

                    {selectedServices.length > 0 ? (
                        <>
                            <Text style={styles.label}>{t('parity.staffBooking.time')}</Text>
                            {slotsQuery.isLoading ? (
                                <Text style={styles.hint}>{t('parity.staffBooking.loadingSlots')}</Text>
                            ) : slotsQuery.isError ? (
                                <View style={styles.inline}>
                                    <Text style={styles.hint}>{t('parity.staffBooking.slotsLoadError')}</Text>
                                    <Button title={t('staff.retry')} onPress={() => void slotsQuery.refetch()} variant="ghost" size="sm" />
                                </View>
                            ) : slots.length === 0 ? (
                                <Text style={styles.hint}>{t('parity.staffBooking.noSlots')}</Text>
                            ) : (
                                <View style={styles.chips}>
                                    {slots.map((slot) => (
                                        <Chip
                                            key={slot.start_at}
                                            label={formatTime(slot.start_at, tz)}
                                            selected={slot.start_at === slotStart}
                                            role="radio"
                                            onPress={() => setSlotStart(slot.start_at)}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    ) : null}
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('parity.staffBooking.client')}</Text>
                    <Text style={styles.hint}>{t('parity.staffBooking.clientDescription')}</Text>
                    <Input
                        label={t('parity.staffBooking.clientName')}
                        placeholder={t('parity.staffBooking.clientNamePlaceholder')}
                        value={clientName}
                        onChangeText={setClientName}
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => phoneRef.current?.focus()}
                        testID="staff-booking-client-name"
                    />
                    <Input
                        ref={phoneRef}
                        label={t('parity.staffBooking.clientPhone')}
                        placeholder="+996555123456"
                        helperText={t('parity.staffBooking.phoneFormat')}
                        value={clientPhone}
                        onChangeText={setClientPhone}
                        keyboardType="phone-pad"
                        returnKeyType="done"
                        testID="staff-booking-client-phone"
                    />
                </Card>

                {formError ? <Text style={styles.error} accessibilityRole="alert">{formError}</Text> : null}
                <Button
                    title={create.isPending ? t('parity.staffBooking.creating') : t('parity.staffBooking.create')}
                    onPress={submit}
                    loading={create.isPending}
                    disabled={!canCreate || create.isPending}
                    fullWidth
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function Chip({ label, selected, onPress, role }: { label: string; selected: boolean; onPress: () => void; role: 'radio' | 'button' }) {
    return (
        <MotionPressable
            onPress={onPress}
            style={[styles.chip, selected ? styles.chipSelected : null]}
            accessibilityRole={role}
            accessibilityState={{ selected }}
            accessibilityLabel={label}
        >
            <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{label}</Text>
        </MotionPressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface.page },
    content: { padding: colors.layout.space5, paddingBottom: colors.layout.space8, gap: colors.layout.space4 },
    card: { gap: colors.layout.space3 },
    sectionTitle: { ...typography.sectionTitle, color: colors.text.primary },
    label: { ...typography.label, color: colors.text.primary, marginTop: colors.layout.space2 },
    hint: { ...typography.caption, color: colors.text.secondary },
    error: { ...typography.body, color: colors.status.danger },
    inline: { flexDirection: 'row', alignItems: 'center', gap: colors.layout.space2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: colors.layout.space2 },
    chip: {
        minHeight: MIN_TOUCH_TARGET,
        minWidth: MIN_TOUCH_TARGET,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.surface.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipSelected: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    chipText: { ...typography.label, color: colors.text.primary },
    chipTextSelected: { color: colors.text.light },
    option: {
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space3,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    optionSelected: { borderColor: colors.accent.primary, backgroundColor: colors.surface.emphasis },
    optionText: { ...typography.body, color: colors.text.primary, flex: 1 },
});
