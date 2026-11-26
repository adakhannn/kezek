import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { filterSlotsByContext } from '@core-domain/schedule';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { colors } from '../../constants/colors';
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
import { Chip, DateStepper, OptionList, SectionTitle, dmy, ui } from './ui';

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

    if (setup.isLoading) return <LoadingSpinner message={t('common.loading')} />;
    if (!setup.data) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('manageStaff.loadError')}
                message={staffErrorMessage(setup.error, t('staff.checkConnection'), t)}
                action={<Button title={t('staff.retry')} onPress={() => void setup.refetch()} variant="outline" fullWidth />}
            />
        );
    }

    return (
        <ScrollView style={ui.container} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" testID="manage-staff-slots">
            <View>
                <Text style={ui.title} accessibilityRole="header">{t('manageStaff.staff.detail.nav.slots')}</Text>
                <Text style={ui.subtitle}>{params.staffName ?? ''}</Text>
            </View>

            {setup.data.services.length === 0 ? (
                <FeedbackBanner variant="warning" title={t('manageStaff.staff.services.empty.title')} message={t('manageStaff.staff.services.empty.desc')} />
            ) : null}

            <Card style={ui.gap}>
                <SectionTitle title={t('manageStaff.staff.slots.filters.title')} />
                <Text style={ui.label}>{t('manageStaff.bookings.desk.branch')}</Text>
                <OptionList
                    options={setup.data.branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                    value={branchId}
                    onChange={setBranchId}
                    disabled={creating}
                    testID="slots-branch"
                />
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
                <DateStepper label={t('manageStaff.bookings.desk.date')} value={date} onChange={setDate} min={today} today={today} disabled={creating} />
            </Card>

            <Card style={ui.gap}>
                <SectionTitle title={t('manageStaff.booking.freeSlots')} />
                {slots.isFetching ? <Text style={ui.muted}>{t('manageStaff.booking.loadingSlots')}</Text> : null}
                {slots.error ? (
                    <FeedbackBanner variant="danger" title={t('manageStaff.staff.error')} message={staffErrorMessage(slots.error, t('manageStaff.loadError'), t)} />
                ) : null}
                {!slots.isFetching && !slots.error && branchId && serviceId && slotList.length === 0 ? (
                    <View>
                        <Text style={ui.text}>{t('manageStaff.booking.noSlots')}</Text>
                        <Text style={ui.muted}>{t('manageStaff.staff.slots.noSlotsHint')}</Text>
                    </View>
                ) : null}
                {!slots.isFetching && !slots.error && slotList.length > 0 ? (
                    <>
                        <Text style={ui.muted}>{t('manageStaff.staff.slots.found')} {slotList.length}</Text>
                        <View style={ui.wrap}>
                            {slotList.map((slot) => (
                                <Chip
                                    key={slot.start_at}
                                    label={`${time(slot.start_at)}–${time(slot.end_at)}`}
                                    selected={slot.start_at === selectedStart}
                                    onPress={() => setSelectedStart(slot.start_at)}
                                    disabled={creating}
                                />
                            ))}
                        </View>
                    </>
                ) : null}
            </Card>

            {selectedSlot && selectedService ? (
                <Card style={[ui.gap, styles.confirm]}>
                    <SectionTitle title={t('manageStaff.booking.confirm.title')} description={t('manageStaff.booking.confirm.description')} />
                    <Text style={ui.label}>{t('manageStaff.booking.confirm.when')}</Text>
                    <Text style={ui.text}>{dmy(formatInTimeZone(new Date(selectedSlot.start_at), tz, 'yyyy-MM-dd'))} {time(selectedSlot.start_at)}–{time(selectedSlot.end_at)}</Text>
                    <Text style={ui.label}>{t('manageStaff.booking.confirm.branch')}</Text>
                    <Text style={ui.text}>{selectedBranch?.name ?? '—'}</Text>
                    <Text style={ui.label}>{t('manageStaff.booking.confirm.staff')}</Text>
                    <Text style={ui.text}>{params.staffName || '—'}</Text>
                    <Text style={ui.label}>{t('manageStaff.bookings.desk.service')}</Text>
                    <Text style={ui.text}>{selectedService.name} {durationLabel(selectedService)}</Text>

                    <View style={ui.divider} />
                    <Text style={ui.label}>{t('manageStaff.bookings.desk.client')}</Text>
                    <View style={ui.wrap}>
                        {(['none', 'existing', 'new'] as const).map((value) => (
                            <Chip
                                key={value}
                                label={t(value === 'none' ? 'manageStaff.bookings.desk.clientNone' : value === 'existing' ? 'manageStaff.bookings.desk.clientExisting' : 'manageStaff.bookings.desk.clientNew')}
                                selected={mode === value}
                                onPress={() => changeMode(value)}
                                disabled={creating}
                            />
                        ))}
                    </View>
                    {mode === 'existing' ? (
                        <>
                            <Input
                                value={searchQ}
                                onChangeText={changeSearch}
                                placeholder={t('manageStaff.bookings.desk.searchPlaceholder')}
                                accessibilityLabel={t('manageStaff.bookings.desk.searchPlaceholder')}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {searchLoading ? <Text style={ui.muted}>{t('manageStaff.bookings.desk.searching')}</Text> : null}
                            {searchErr ? <FeedbackBanner variant="danger" message={searchErr} /> : null}
                            {!searchLoading && searchQ.trim() && foundUsers.length === 0 && !searchErr ? (
                                <Text style={ui.muted}>{t('manageStaff.bookings.desk.noResults')}</Text>
                            ) : null}
                            {foundUsers.length > 0 ? (
                                <OptionList
                                    options={foundUsers.map((user) => ({ value: user.id, label: user.full_name, hint: user.phone || user.email || undefined }))}
                                    value={selectedClientId}
                                    onChange={setSelectedClientId}
                                />
                            ) : null}
                        </>
                    ) : null}
                    {mode === 'new' ? (
                        <>
                            <Input label={t('manageStaff.bookings.desk.clientName')} value={newClientName} onChangeText={setNewClientName} placeholder={t('manageStaff.bookings.desk.clientNamePlaceholder')} />
                            <Input label={t('manageStaff.bookings.desk.clientPhone')} value={newClientPhone} onChangeText={setNewClientPhone} placeholder="+996555123456" keyboardType="phone-pad" />
                        </>
                    ) : null}
                    <Button
                        title={t(creating ? 'manageStaff.booking.confirm.saving' : 'manageStaff.booking.confirm.submit')}
                        onPress={() => void confirmBooking()}
                        disabled={!canConfirm}
                        loading={creating}
                        fullWidth
                    />
                    <Button title={t('manageStaff.booking.confirm.cancel')} onPress={() => setSelectedStart('')} disabled={creating} variant="ghost" fullWidth />
                </Card>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    confirm: { borderColor: colors.accent.primary, borderWidth: 1 },
});
