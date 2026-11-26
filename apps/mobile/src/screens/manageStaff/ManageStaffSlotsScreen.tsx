import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { filterSlotsByContext } from '@core-domain/schedule';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import SegmentedTabs from '../../components/SegmentedTabs';
import ActionBar from '../../components/ui/ActionBar';
import Card from '../../components/ui/Card';
import ChipGroup from '../../components/ui/ChipGroup';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField from '../../components/ui/FormField';
import Input from '../../components/ui/Input';
import { KeyValueRow } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import { SkeletonBlock, SkeletonCard, SkeletonList } from '../../components/ui/Skeleton';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { radii, space } from '../../constants/theme';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { apiRequest } from '../../lib/api';
import { acknowledgeBookingRequest, getBookingRequestKey } from '../../lib/bookingRequest';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { businessTodayYmd } from '../../utils/businessWeek';
import { ensureCurrentBusiness } from '../manage/currentBusiness';
import { searchUsers } from './api';
import { staffErrorMessage } from './errors';
import { staffQueryKeys } from './queryKeys';
import { canSubmitSlotClient, internalBookingInput, slotClientPayload, uniqueSlots, type SlotClientMode } from './slots';
import type { FoundUser } from './types';
import { DateStepper, OptionList, dmy, ui } from './ui';

type Slot = { staff_id: string; branch_id: string; start_at: string; end_at: string };
type SlotService = { id: string; name: string; duration_min: number; branch_id: string };

/**
 * /dashboard/staff/[id]/slots: the staff member's free slots by branch, service and day. A tap only
 * selects a slot; the booking is created by the explicit confirmation with a client (FE-12).
 */
export default function ManageStaffSlotsScreen() {
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageStaffSlots'>>();
    const { t } = useLanguage();
    const { showToast } = useToast();
    const tz = resolveBusinessTimeZone(params.tz);
    const today = businessTodayYmd(tz);

    const [branchId, setBranchId] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [date, setDate] = useState(today);
    const [selectedStart, setSelectedStart] = useState('');
    const [creating, setCreating] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const inFlight = useRef(false);

    const [mode, setMode] = useState<SlotClientMode>('none');
    const [searchQ, setSearchQ] = useState('');
    const [foundUsers, setFoundUsers] = useState<FoundUser[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchErr, setSearchErr] = useState<string | null>(null);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    // The server page's reads: active branches and the services this master performs.
    const setup = useQuery({
        queryKey: [...staffQueryKeys.business(params.bizId), 'slots-setup', params.staffId],
        queryFn: async () => {
            await ensureCurrentBusiness(params.bizId);
            const [branches, services] = await Promise.all([
                supabase.from('branches').select('id, name, is_active').eq('biz_id', params.bizId).eq('is_active', true).order('name'),
                supabase.from('services')
                    .select('id, name_ru, duration_min, branch_id, active, service_staff!inner ( staff_id, is_active )')
                    .eq('biz_id', params.bizId)
                    .eq('active', true)
                    .eq('service_staff.staff_id', params.staffId)
                    .eq('service_staff.is_active', true)
                    .order('name_ru'),
            ]);
            if (branches.error) throw branches.error;
            if (services.error) throw services.error;
            return {
                branches: (branches.data ?? []).map((branch: { id: string; name: string }) => ({ id: String(branch.id), name: String(branch.name) })),
                services: (services.data ?? []).map((service: { id: string; name_ru: string; duration_min: number; branch_id: string }): SlotService => ({
                    id: String(service.id), name: String(service.name_ru), duration_min: Number(service.duration_min), branch_id: String(service.branch_id),
                })),
            };
        },
    });

    const servicesByBranch = useMemo(
        () => (branchId ? (setup.data?.services ?? []).filter((service) => service.branch_id === branchId) : []),
        [setup.data, branchId],
    );

    useEffect(() => { setServiceId(''); }, [branchId]);
    useEffect(() => { setSelectedStart(''); }, [branchId, serviceId, date]);

    const slots = useQuery({
        queryKey: [...staffQueryKeys.business(params.bizId), 'slots', params.staffId, branchId, serviceId, date, reloadKey],
        enabled: !!branchId && !!serviceId && !!date,
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
                p_biz_id: params.bizId,
                p_service_id: serviceId,
                p_day: date,
                p_per_staff: 400,
                p_step_min: 15,
                p_staff_id: params.staffId,
            });
            // A failed load is an error, not "no free slots".
            if (error) throw error;
            const filtered = filterSlotsByContext((data ?? []) as Slot[], {
                staffId: params.staffId,
                branchId,
                isTemporaryTransfer: false,
                minStart: new Date(Date.now() + 30 * 60 * 1000),
            });
            return uniqueSlots(filtered as Slot[]);
        },
    });

    // Existing client search, debounced like the website's (500 ms).
    useEffect(() => {
        if (mode !== 'existing' || !searchQ.trim()) return;
        let active = true;
        const timer = setTimeout(() => {
            void searchUsers(params.bizId, searchQ.trim())
                .then((items) => { if (active) setFoundUsers(items); })
                .catch((error) => { if (active) { setSearchErr(staffErrorMessage(error, t('manageStaff.searchFailed'), t)); setFoundUsers([]); } })
                .finally(() => { if (active) setSearchLoading(false); });
        }, 500);
        return () => { active = false; clearTimeout(timer); };
    }, [mode, searchQ, params.bizId, t]);

    const changeMode = (next: SlotClientMode) => {
        setMode(next);
        if (next !== 'new') { setNewClientName(''); setNewClientPhone(''); }
        if (next !== 'existing') { setSearchQ(''); setFoundUsers([]); setSelectedClientId(''); setSearchErr(null); setSearchLoading(false); }
    };
    const changeSearch = (value: string) => {
        setSearchQ(value);
        setSelectedClientId('');
        setFoundUsers([]);
        setSearchErr(null);
        setSearchLoading(mode === 'existing' && !!value.trim());
    };
    const resetClient = () => changeMode('none');

    const clientState = { mode, selectedClientId, foundUsers, searchLoading, newClientName, newClientPhone };
    const slotList = slots.data ?? [];
    const selectedSlot = slotList.find((slot) => slot.start_at === selectedStart) ?? null;
    const selectedService = servicesByBranch.find((service) => service.id === serviceId) ?? null;
    const selectedBranch = setup.data?.branches.find((branch) => branch.id === branchId) ?? null;
    const canConfirm = !!selectedSlot && !!selectedService && !slots.isFetching && !creating && canSubmitSlotClient(clientState);
    const time = (iso: string) => formatInTimeZone(new Date(iso), tz, 'HH:mm');
    const durationLabel = (service: SlotService) => t('manageStaff.staff.slots.serviceDuration', { minutes: String(service.duration_min) });

    const confirmBooking = async () => {
        if (inFlight.current || !selectedSlot || !selectedService) return;
        const client = slotClientPayload(clientState);
        if (!client.ok) { showToast(t(client.error), 'error'); return; }
        inFlight.current = true;
        setCreating(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            if (!userId) throw new Error(t('manageStaff.bookings.internal.signInRequired'));
            const input = internalBookingInput({
                bizId: params.bizId, branchId, staffId: params.staffId, serviceId: selectedService.id,
                startAt: selectedSlot.start_at, minutes: selectedService.duration_min, client: client.payload,
            });
            // The same request identity on a retry: a lost answer replays, never books twice.
            const identity = { kind: 'internal', payload: input };
            const requestId = await getBookingRequestKey(userId, identity);
            await ensureCurrentBusiness(params.bizId);
            const response = await apiRequest<{ ok?: boolean; message?: string; data?: { confirmed?: boolean; booking_id?: string } }>('/api/bookings/internal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId },
                body: JSON.stringify(input),
            });
            const bookingId = response?.data?.booking_id;
            if (response?.ok !== true || response.data?.confirmed !== true || typeof bookingId !== 'string') {
                throw new Error(response?.message || t('manageStaff.bookings.internal.unconfirmed'));
            }
            try { await acknowledgeBookingRequest(userId, identity, requestId); } catch { /* A retained key safely replays the receipt. */ }
            showToast(t('manageStaff.staff.slots.bookingCreated', { id: bookingId.slice(0, 8) }), 'success');
            setSelectedStart('');
            resetClient();
        } catch (error) {
            // The selection and the client stay, so a retry sends the same booking.
            showToast(staffErrorMessage(error, t('manageStaff.bookings.internal.unconfirmed'), t), 'error');
        } finally {
            inFlight.current = false;
            setCreating(false);
            // A taken slot disappears, and a booking whose answer was lost shows up.
            setReloadKey((key) => key + 1);
        }
    };

    if (setup.isLoading) {
        return (
            <Screen>
                <SkeletonCard lines={3} />
                <SkeletonCard lines={2} />
            </Screen>
        );
    }
    if (!setup.data) {
        return (
            <Screen>
                <ErrorState
                    title={t('manageStaff.loadError')}
                    message={staffErrorMessage(setup.error, t('staff.checkConnection'), t)}
                    onRetry={() => void setup.refetch()}
                />
            </Screen>
        );
    }

    const confirming = !!selectedSlot && !!selectedService;

    return (
        <Screen
            keyboard
            gap={space.xxl}
            testID="manage-staff-slots"
            footer={confirming ? (
                <ActionBar
                    secondary={{ title: t('manageStaff.booking.confirm.cancel'), onPress: () => setSelectedStart(''), disabled: creating }}
                    primary={{
                        title: t(creating ? 'manageStaff.booking.confirm.saving' : 'manageStaff.booking.confirm.submit'),
                        onPress: () => void confirmBooking(),
                        disabled: !canConfirm,
                        loading: creating,
                        testID: 'slots-confirm',
                    }}
                />
            ) : undefined}
        >
            {/* The header says "Свободные слоты": one muted line names the person. */}
            {params.staffName ? <ScreenIntro>{params.staffName}</ScreenIntro> : null}

            {setup.data.services.length === 0 ? (
                <FeedbackBanner variant="warning" title={t('manageStaff.staff.services.empty.title')} message={t('manageStaff.staff.services.empty.desc')} compact />
            ) : null}

            <Section>
                {setup.data.branches.length > 0 ? (
                    <ChipGroup
                        options={setup.data.branches.map((branch) => ({ key: branch.id, label: branch.name }))}
                        value={branchId || null}
                        onChange={setBranchId}
                        disabled={creating}
                        accessibilityLabel={t('manageStaff.bookings.desk.branch')}
                        testID="slots-branch"
                    />
                ) : null}
                <View style={ui.card}>
                    <Text style={ui.label}>{t('manageStaff.bookings.desk.service')}</Text>
                    {!branchId ? (
                        <Text style={ui.muted}>{t('manageStaff.bookings.desk.selectBranchFirst')}</Text>
                    ) : servicesByBranch.length === 0 ? (
                        <Text style={ui.muted}>{t('manageStaff.bookings.desk.noServices')}</Text>
                    ) : (
                        <OptionList
                            options={servicesByBranch.map((service) => ({ value: service.id, label: service.name, hint: durationLabel(service) }))}
                            value={serviceId}
                            onChange={setServiceId}
                            disabled={creating}
                            testID="slots-service"
                        />
                    )}
                    <View style={ui.hairline} />
                    <DateStepper label={t('manageStaff.bookings.desk.date')} value={date} onChange={setDate} min={today} today={today} disabled={creating} />
                </View>
            </Section>

            {branchId && serviceId ? (
                <Section
                    title={t('manageStaff.booking.freeSlots')}
                    caption={!slots.isFetching && !slots.error && slotList.length > 0 ? `${t('manageStaff.staff.slots.found')} ${slotList.length}` : undefined}
                >
                    {slots.isFetching ? <SkeletonBlock height={MIN_TOUCH_TARGET} radius={radii.pill} /> : null}
                    {slots.error ? (
                        <ErrorState
                            compact
                            title={t('manageStaff.staff.error')}
                            message={staffErrorMessage(slots.error, t('manageStaff.loadError'), t)}
                            onRetry={() => void slots.refetch()}
                        />
                    ) : null}
                    {!slots.isFetching && !slots.error && slotList.length === 0 ? (
                        <EmptyState
                            icon="time-outline"
                            compact
                            title={t('manageStaff.booking.noSlots')}
                            message={t('manageStaff.staff.slots.noSlotsHint')}
                        />
                    ) : null}
                    {!slots.isFetching && !slots.error && slotList.length > 0 ? (
                        <ChipGroup
                            layout="wrap"
                            options={slotList.map((slot) => ({ key: slot.start_at, label: `${time(slot.start_at)}–${time(slot.end_at)}` }))}
                            value={selectedStart || null}
                            onChange={setSelectedStart}
                            disabled={creating}
                            accessibilityLabel={t('manageStaff.booking.freeSlots')}
                            testID="slots-list"
                        />
                    ) : null}
                </Section>
            ) : null}

            {selectedSlot && selectedService ? (
                <Section title={t('manageStaff.booking.confirm.title')} caption={t('manageStaff.booking.confirm.description')}>
                    <Card variant="plain" padding="md" style={styles.summary}>
                        <KeyValueRow
                            label={t('manageStaff.booking.confirm.when')}
                            value={`${dmy(formatInTimeZone(new Date(selectedSlot.start_at), tz, 'yyyy-MM-dd'))} ${time(selectedSlot.start_at)}–${time(selectedSlot.end_at)}`}
                            emphasis
                        />
                        <KeyValueRow label={t('manageStaff.booking.confirm.branch')} value={selectedBranch?.name ?? '—'} />
                        <KeyValueRow label={t('manageStaff.booking.confirm.staff')} value={params.staffName || '—'} />
                        <KeyValueRow label={t('manageStaff.bookings.desk.service')} value={`${selectedService.name} ${durationLabel(selectedService)}`} />
                    </Card>

                    <Text style={ui.label}>{t('manageStaff.bookings.desk.client')}</Text>
                    <SegmentedTabs
                        tabs={(['none', 'existing', 'new'] as const).map((value) => ({
                            key: value,
                            label: t(value === 'none' ? 'manageStaff.bookings.desk.clientNone' : value === 'existing' ? 'manageStaff.bookings.desk.clientExisting' : 'manageStaff.bookings.desk.clientNew'),
                        }))}
                        value={mode}
                        onChange={(value) => { if (!creating) changeMode(value); }}
                    />
                    {mode === 'existing' ? (
                        <>
                            <Input
                                value={searchQ}
                                onChangeText={changeSearch}
                                placeholder={t('manageStaff.bookings.desk.searchPlaceholder')}
                                accessibilityLabel={t('manageStaff.bookings.desk.searchPlaceholder')}
                                leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                                autoCapitalize="none"
                                autoCorrect={false}
                                containerStyle={styles.search}
                            />
                            {searchLoading ? <SkeletonList rows={2} /> : null}
                            {searchErr ? <FeedbackBanner variant="danger" message={searchErr} compact /> : null}
                            {!searchLoading && searchQ.trim() && foundUsers.length === 0 && !searchErr ? (
                                <Text style={ui.muted}>{t('manageStaff.bookings.desk.noResults')}</Text>
                            ) : null}
                            {foundUsers.length > 0 ? (
                                <OptionList
                                    card
                                    options={foundUsers.map((user) => ({ value: user.id, label: user.full_name, hint: user.phone || user.email || undefined }))}
                                    value={selectedClientId}
                                    onChange={setSelectedClientId}
                                />
                            ) : null}
                        </>
                    ) : null}
                    {mode === 'new' ? (
                        <View>
                            <FormField label={t('manageStaff.bookings.desk.clientName')} value={newClientName} onChangeText={setNewClientName} placeholder={t('manageStaff.bookings.desk.clientNamePlaceholder')} />
                            <FormField label={t('manageStaff.bookings.desk.clientPhone')} value={newClientPhone} onChangeText={setNewClientPhone} placeholder="+996555123456" keyboardType="phone-pad" containerStyle={styles.lastField} />
                        </View>
                    ) : null}
                </Section>
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    summary: { paddingVertical: space.sm },
    search: { marginBottom: 0 },
    lastField: { marginBottom: 0 },
});
