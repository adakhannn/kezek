import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { filterSlotsByContext, resolveScheduleContext } from '@core-domain/schedule';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import { getServiceName } from '../../../utils/i18n';
import { addDaysToDate, todayInTz } from '../opsKit/dates';
import { dayLabel } from '../opsKit/format';
import { ChipGroup, Field, LoadError, ui } from '../opsKit/ui';
import SellPackageModal from '../visitPackages/SellPackageModal';
import {
    fetchFreeSlots,
    fetchServiceStaffMap,
    fetchWorkLocations,
    searchClients,
    type BookingOptions,
    type FoundUser,
} from './bookingsData';
import type { BookingsTab } from './ManageBookingsScreen';
import {
    canSubmitClient,
    createInternalBooking,
    internalBookingInput,
    quickDeskClientPayload,
    servicesForMaster,
    staffWorkingInBranch,
    targetBranchFor,
    temporaryTransfersFor,
    type ClientMode,
} from './quickDesk';

const SEARCH_DELAY_MS = 500;

/**
 * QuickDesk: branch → day → master working there that day → service the master performs → free
 * time → client (none, an existing account, or a new name and phone) → the booking.
 */
export default function QuickDeskTab({
    bizId,
    timezone,
    options,
    onTabChange,
}: {
    bizId: string;
    timezone: string;
    options: BookingOptions;
    onTabChange: (tab: BookingsTab) => void;
}) {
    const { t, locale } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const today = todayInTz(timezone);
    const tomorrow = addDaysToDate(today, 1);
    const [branchId, setBranchIdState] = useState(options.branches.length === 1 ? options.branches[0].id : '');
    const [date, setDateState] = useState(today);
    const [staffId, setStaffIdState] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [slot, setSlot] = useState('');
    const [creating, setCreating] = useState(false);

    const [clientMode, setClientModeState] = useState<ClientMode>('none');
    const [searchQ, setSearchQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [sellOpen, setSellOpen] = useState(false);

    // The form resets as on the website: a branch starts the day over, a day the master, a master the service.
    const setBranchId = (value: string) => { setBranchIdState(value); setDateState(todayInTz(timezone)); setStaffIdState(''); setServiceId(''); setSlot(''); };
    const setDate = (value: string) => { setDateState(value); setStaffIdState(''); setServiceId(''); setSlot(''); };
    const setStaffId = (value: string) => { setStaffIdState(value); setServiceId(''); setSlot(''); };
    const setClientMode = (mode: ClientMode) => {
        setClientModeState(mode);
        if (mode !== 'new') { setNewClientName(''); setNewClientPhone(''); }
        if (mode !== 'existing') { setSearchQ(''); setDebouncedQ(''); setSelectedClientId(''); }
    };

    const locations = useQuery({
        queryKey: ['manage-work-locations', bizId, date],
        queryFn: () => fetchWorkLocations(bizId, date),
        enabled: options.staff.length > 0,
    });
    const staffIds = useMemo(() => options.staff.map((member) => member.id), [options.staff]);
    const serviceStaff = useQuery({
        queryKey: ['manage-service-staff', bizId, staffIds],
        queryFn: () => fetchServiceStaffMap(staffIds),
    });
    const transfers = useMemo(() => temporaryTransfersFor(locations.data ?? [], options.staff), [locations.data, options.staff]);

    // FE-08: without the day's work places it is unknown who works here, so no master is offered.
    const staffHere = useMemo(
        () => (branchId && locations.data ? staffWorkingInBranch(options.staff, branchId, date, transfers) : []),
        [branchId, locations.data, options.staff, date, transfers],
    );
    // FE-08: fail closed; without the service-staff map every branch service would be offered.
    const services = useMemo(
        () => (serviceStaff.error || serviceStaff.data === undefined ? [] : servicesForMaster({
            services: options.services, staff: options.staff, staffId, branchId, date, transfers, serviceToStaffMap: serviceStaff.data,
        })),
        [serviceStaff.error, serviceStaff.data, options.services, options.staff, staffId, branchId, date, transfers],
    );
    const service = services.find((item) => item.id === serviceId);

    const scheduleContext = branchId && staffId
        ? resolveScheduleContext({
              staffId, dayStr: date, selectedBranchId: branchId, temporaryTransfers: transfers,
              staff: options.staff.map((member) => ({ id: member.id, branch_id: member.branch_id })),
          })
        : null;
    const slots = useQuery({
        queryKey: ['manage-desk-slots', bizId, branchId, staffId, serviceId, date, scheduleContext?.targetBranchId, scheduleContext?.isTemporaryTransfer],
        queryFn: async () => {
            const raw = await fetchFreeSlots({ bizId, serviceId, staffId, day: date });
            const filtered = filterSlotsByContext(raw, {
                staffId,
                branchId,
                targetBranchId: scheduleContext?.targetBranchId,
                isTemporaryTransfer: scheduleContext?.isTemporaryTransfer ?? false,
                minStart: addMinutes(new Date(), 30),
            });
            return Array.from(new Map(filtered.map((item) => [item.start_at, item])).values());
        },
        enabled: !!(branchId && staffId && service && scheduleContext),
    });
    // The first free time is chosen, as on the website; a choice that disappeared is replaced.
    useEffect(() => {
        const list = slots.data ?? [];
        if (!list.some((item) => item.start_at === slot)) setSlot(list[0]?.start_at ?? '');
    }, [slots.data, slot]);

    useEffect(() => {
        const next = searchQ.trim();
        const timer = setTimeout(() => setDebouncedQ(next), next ? SEARCH_DELAY_MS : 0);
        return () => clearTimeout(timer);
    }, [searchQ]);
    const search = useQuery({
        queryKey: ['manage-desk-client-search', bizId, debouncedQ],
        queryFn: ({ signal }) => searchClients(debouncedQ, signal),
        enabled: clientMode === 'existing' && !!debouncedQ,
    });
    const foundUsers: FoundUser[] = clientMode === 'existing' && debouncedQ === searchQ.trim() ? search.data ?? [] : [];
    const searchLoading = clientMode === 'existing' && !!searchQ.trim() && (debouncedQ !== searchQ.trim() || search.isFetching);
    const selectedClient = foundUsers.find((user) => user.id === selectedClientId);
    const clientState = { mode: clientMode, selectedClientId, foundUsers, searchLoading, newClientName, newClientPhone };

    const canCreate = !!(branchId && service && staffId && canSubmitClient(clientState)
        && staffHere.some((member) => member.id === staffId) && !slots.isFetching
        && (slots.data ?? []).some((item) => item.start_at === slot && item.staff_id === staffId));

    const create = async () => {
        if (!service) { showToast(t('ops.desk.errors.selectService'), 'error'); return; }
        if (!slot) { showToast(t('ops.desk.errors.noSlots'), 'error'); return; }
        if (!staffId) { showToast(t('ops.desk.errors.selectMaster'), 'error'); return; }
        const client = quickDeskClientPayload(clientState, t);
        if (!client.ok) { showToast(client.error, 'error'); return; }
        setCreating(true);
        try {
            const bookingId = await createInternalBooking(internalBookingInput({
                bizId,
                branchId: targetBranchFor(options.staff, staffId, branchId, date, transfers),
                staffId,
                serviceId: service.id,
                startAt: slot,
                durationMin: service.duration_min,
                client: client.payload,
            }), t);
            showToast(t('ops.desk.created', { id: bookingId.slice(0, 8) }), 'success');
            setServiceId('');
            setStaffIdState('');
            setSlot('');
            setClientMode('none');
            void queryClient.invalidateQueries({ queryKey: ['manage-desk-slots'] });
            void queryClient.invalidateQueries({ queryKey: ['manage-bookings-list'] });
            void queryClient.invalidateQueries({ queryKey: ['manage-calendar-day'] });
            void queryClient.invalidateQueries({ queryKey: ['manager-bookings'] });
        } catch (error) {
            showToast(getErrorMessage(error, t('ops.desk.errors.createFailed'), t), 'error');
        } finally {
            setCreating(false);
        }
    };

    return (
        <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" testID="quickdesk-tab">
            <Card padding="md">
                <Text style={ui.muted}>{t('ops.desk.mode')}</Text>
                <Text style={ui.sectionTitle}>{t('ops.desk.title')}</Text>
                <Text style={ui.muted}>{t('ops.desk.description')}</Text>
            </Card>

            <Field label={t('ops.desk.branch')}>
                {options.branches.length === 0 ? <Text style={ui.muted}>{t('ops.desk.noBranches')}</Text> : (
                    <ChipGroup
                        options={options.branches.map((branch) => ({ key: branch.id, label: branch.name }))}
                        value={branchId || null}
                        onChange={setBranchId}
                        disabled={creating}
                        testID="desk-branch"
                    />
                )}
            </Field>

            {branchId ? (
                <Field label={t('ops.desk.date')}>
                    <ChipGroup
                        options={[{ key: today, label: t('ops.desk.today') }, { key: tomorrow, label: t('ops.desk.tomorrow') }]}
                        value={date === today || date === tomorrow ? date : null}
                        onChange={setDate}
                        disabled={creating}
                        testID="desk-day"
                    />
                    <View style={ui.row}>
                        <Button title="‹" onPress={() => setDate(addDaysToDate(date, -1))} variant="outline" size="sm" disabled={creating || date <= today} accessibilityLabel={t('ops.common.prevDay')} />
                        <Text style={[ui.text, { flex: 1, textAlign: 'center' }]}>{dayLabel(date, locale)}</Text>
                        <Button title="›" onPress={() => setDate(addDaysToDate(date, 1))} variant="outline" size="sm" disabled={creating} accessibilityLabel={t('ops.common.nextDay')} />
                    </View>
                </Field>
            ) : null}

            {branchId ? (
                <Field label={t('ops.desk.master')}>
                    {locations.isLoading ? <LoadingSpinner size="small" /> : locations.error ? (
                        <LoadError title={t('ops.desk.errors.staffLoad')} onRetry={() => void locations.refetch()} />
                    ) : staffHere.length === 0 ? <Text style={ui.muted}>{t('ops.desk.noStaff')}</Text> : (
                        <ChipGroup
                            options={staffHere.map((member) => ({ key: member.id, label: member.full_name }))}
                            value={staffId || null}
                            onChange={setStaffId}
                            disabled={creating}
                            testID="desk-staff"
                        />
                    )}
                </Field>
            ) : null}

            {staffId ? (
                <Field label={t('ops.desk.service')}>
                    {serviceStaff.isLoading ? <LoadingSpinner size="small" /> : serviceStaff.error ? (
                        <LoadError title={t('ops.desk.errors.servicesLoad')} onRetry={() => void serviceStaff.refetch()} />
                    ) : services.length === 0 ? <Text style={ui.muted}>{t('ops.desk.noServices')}</Text> : (
                        <ChipGroup
                            options={services.map((item) => ({ key: item.id, label: `${getServiceName(item, locale)} · ${item.duration_min} ${t('ops.bookings.min')}` }))}
                            value={serviceId || null}
                            onChange={(value) => { setServiceId(value); setSlot(''); }}
                            disabled={creating}
                            testID="desk-service"
                        />
                    )}
                </Field>
            ) : null}

            {service ? (
                <Field label={t('ops.desk.time')}>
                    {slots.isLoading ? <LoadingSpinner size="small" message={t('ops.desk.slotsLoading')} /> : slots.error ? (
                        <LoadError title={t('ops.desk.errors.slotsLoad')} onRetry={() => void slots.refetch()} />
                    ) : (slots.data ?? []).length === 0 ? <Text style={ui.muted}>{t('ops.desk.errors.noSlots')}</Text> : (
                        <ChipGroup
                            options={(slots.data ?? []).map((item) => ({ key: item.start_at, label: formatInTimeZone(new Date(item.start_at), timezone, 'HH:mm') }))}
                            value={slot || null}
                            onChange={setSlot}
                            disabled={creating}
                            testID="desk-slot"
                        />
                    )}
                </Field>
            ) : null}

            <Card padding="md">
                <Text style={ui.fieldLabel}>{t('ops.desk.client')}</Text>
                <ChipGroup
                    options={[
                        { key: 'none', label: t('ops.desk.clientNone') },
                        { key: 'existing', label: t('ops.desk.clientExisting') },
                        { key: 'new', label: t('ops.desk.clientNew') },
                    ]}
                    value={clientMode}
                    onChange={setClientMode}
                    disabled={creating}
                    testID="desk-client-mode"
                />
                <Text style={[ui.hint, { marginBottom: colors.layout.space2 }]}>
                    {t(clientMode === 'none' ? 'ops.desk.clientNone.hint' : clientMode === 'existing' ? 'ops.desk.clientExisting.searchHint' : 'ops.desk.clientNew.formHint')}
                </Text>
                {clientMode === 'existing' ? (
                    <View style={{ gap: colors.layout.space2 }}>
                        <Input
                            value={searchQ}
                            onChangeText={(value) => { setSearchQ(value); setSelectedClientId(''); }}
                            placeholder={t('ops.desk.searchPlaceholder')}
                            accessibilityLabel={t('ops.desk.searchPlaceholder')}
                            autoCapitalize="none"
                            autoCorrect={false}
                            testID="desk-client-search"
                        />
                        {searchLoading ? <Text style={ui.muted}>{t('ops.desk.searching')}</Text> : null}
                        {search.error && !searchLoading ? <Text style={[ui.muted, ui.dangerText]}>{t('ops.desk.errors.searchFailed')}</Text> : null}
                        {!searchLoading && !search.error && debouncedQ && foundUsers.length === 0 ? <Text style={ui.muted}>{t('ops.desk.notFound')}</Text> : null}
                        <ChipGroup
                            options={foundUsers.map((user) => ({
                                key: user.id,
                                label: [user.full_name, user.phone, user.email].filter(Boolean).join(' · '),
                            }))}
                            value={selectedClientId || null}
                            onChange={setSelectedClientId}
                            disabled={creating}
                            testID="desk-client-found"
                        />
                        {selectedClient ? (
                            <View style={ui.rowBetween}>
                                <Text style={[ui.muted, ui.successText]}>{t('ops.desk.clientMode.found')}</Text>
                                <Button title={t('ops.packages.sell.button')} onPress={() => setSellOpen(true)} variant="ghost" size="sm" />
                            </View>
                        ) : null}
                    </View>
                ) : null}
                {clientMode === 'new' ? (
                    <View style={{ gap: colors.layout.space2 }}>
                        <Input value={newClientName} onChangeText={setNewClientName} placeholder={t('ops.desk.clientName')} accessibilityLabel={t('ops.desk.clientName')} testID="desk-client-name" />
                        <Input
                            value={newClientPhone}
                            onChangeText={setNewClientPhone}
                            placeholder={t('ops.desk.clientPhone')}
                            accessibilityLabel={t('ops.desk.clientPhone')}
                            keyboardType="phone-pad"
                            testID="desk-client-phone"
                        />
                    </View>
                ) : null}
            </Card>

            <Card padding="md">
                <Text style={ui.fieldLabel}>{t('ops.desk.primaryAction')}</Text>
                <Text style={[ui.muted, { marginBottom: colors.layout.space2 }]}>{t('ops.desk.primaryActionDesc')}</Text>
                <Button
                    title={creating ? t('ops.desk.creating') : t('ops.desk.create')}
                    onPress={() => void create()}
                    disabled={!canCreate || creating}
                    loading={creating}
                    fullWidth
                />
                <View style={[ui.wrap, { marginTop: colors.layout.space2 }]}>
                    <Button title={t('ops.desk.goToCalendar')} onPress={() => onTabChange('calendar')} variant="outline" size="sm" />
                    <Button title={t('ops.desk.goToList')} onPress={() => onTabChange('list')} variant="outline" size="sm" />
                </View>
            </Card>

            {selectedClient ? (
                <SellPackageModal
                    bizId={bizId}
                    visible={sellOpen}
                    clientId={selectedClient.id}
                    clientName={selectedClient.full_name}
                    onClose={() => setSellOpen(false)}
                />
            ) : null}
        </ScrollView>
    );
}
