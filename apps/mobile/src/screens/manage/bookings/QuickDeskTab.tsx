import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { filterSlotsByContext, resolveScheduleContext } from '@core-domain/schedule';

import ActionBar from '../../../components/ui/ActionBar';
import Avatar from '../../../components/ui/Avatar';
import ChipGroup from '../../../components/ui/ChipGroup';
import { DateNavigator } from '../../../components/ui/DateTimeFields';
import FormField from '../../../components/ui/FormField';
import Input from '../../../components/ui/Input';
import ListRow, { ListGroup } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import Section from '../../../components/ui/Section';
import { SkeletonBlock } from '../../../components/ui/Skeleton';
import { colors } from '../../../constants/colors';
import { space } from '../../../constants/theme';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import { getServiceName } from '../../../utils/i18n';
import { todayInTz } from '../opsKit/dates';
import { Field, LoadError, ui } from '../opsKit/ui';
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

    const chipsLoading = <SkeletonBlock height={44} radius={22} width="70%" />;

    return (
        <Screen
            keyboard
            testID="quickdesk-tab"
            footer={(
                <ActionBar
                    secondary={{ title: t('ops.desk.goToCalendar'), onPress: () => onTabChange('calendar'), disabled: creating }}
                    primary={{
                        title: creating ? t('ops.desk.creating') : t('ops.desk.create'),
                        onPress: () => void create(),
                        disabled: !canCreate || creating,
                        loading: creating,
                        testID: 'desk-create',
                    }}
                />
            )}
        >
            {/* The visit: branch → day → master → service → time, each step opens after the previous one. */}
            <Section title={t('ops.desk.visit')} gap={space.lg}>
                <Field label={t('ops.desk.branch')}>
                    {options.branches.length === 0 ? <Text style={ui.muted}>{t('ops.desk.noBranches')}</Text> : (
                        <ChipGroup
                            options={options.branches.map((branch) => ({ key: branch.id, label: branch.name }))}
                            value={branchId || null}
                            onChange={setBranchId}
                            disabled={creating}
                            accessibilityLabel={t('ops.desk.branch')}
                            testID="desk-branch"
                        />
                    )}
                </Field>

                {branchId ? (
                    <Field label={t('ops.desk.date')}>
                        <DateNavigator value={date} onChange={setDate} minDate={today} timeZone={timezone} disabled={creating} testID="desk-date" />
                    </Field>
                ) : null}

                {branchId ? (
                    <Field label={t('ops.desk.master')}>
                        {locations.isLoading ? chipsLoading : locations.error ? (
                            <LoadError compact title={t('ops.desk.errors.staffLoad')} onRetry={() => void locations.refetch()} />
                        ) : staffHere.length === 0 ? <Text style={ui.muted}>{t('ops.desk.noStaff')}</Text> : (
                            <ChipGroup
                                options={staffHere.map((member) => ({ key: member.id, label: member.full_name }))}
                                value={staffId || null}
                                onChange={setStaffId}
                                disabled={creating}
                                accessibilityLabel={t('ops.desk.master')}
                                testID="desk-staff"
                            />
                        )}
                    </Field>
                ) : null}

                {staffId ? (
                    <Field label={t('ops.desk.service')}>
                        {serviceStaff.isLoading ? chipsLoading : serviceStaff.error ? (
                            <LoadError compact title={t('ops.desk.errors.servicesLoad')} onRetry={() => void serviceStaff.refetch()} />
                        ) : services.length === 0 ? <Text style={ui.muted}>{t('ops.desk.noServices')}</Text> : (
                            <ChipGroup
                                options={services.map((item) => ({ key: item.id, label: `${getServiceName(item, locale)} · ${item.duration_min} ${t('ops.bookings.min')}` }))}
                                value={serviceId || null}
                                onChange={(value) => { setServiceId(value); setSlot(''); }}
                                disabled={creating}
                                accessibilityLabel={t('ops.desk.service')}
                                testID="desk-service"
                            />
                        )}
                    </Field>
                ) : null}

                {service ? (
                    <Field label={t('ops.desk.time')}>
                        {slots.isLoading ? chipsLoading : slots.error ? (
                            <LoadError compact title={t('ops.desk.errors.slotsLoad')} onRetry={() => void slots.refetch()} />
                        ) : (slots.data ?? []).length === 0 ? <Text style={ui.muted}>{t('ops.desk.errors.noSlots')}</Text> : (
                            <ChipGroup
                                options={(slots.data ?? []).map((item) => ({ key: item.start_at, label: formatInTimeZone(new Date(item.start_at), timezone, 'HH:mm') }))}
                                value={slot || null}
                                onChange={setSlot}
                                disabled={creating}
                                accessibilityLabel={t('ops.desk.time')}
                                testID="desk-slot"
                            />
                        )}
                    </Field>
                ) : null}
            </Section>

            <Section
                title={t('ops.desk.client')}
                caption={t(clientMode === 'none' ? 'ops.desk.clientNone.hint' : clientMode === 'existing' ? 'ops.desk.clientExisting.searchHint' : 'ops.desk.clientNew.formHint')}
            >
                <ChipGroup
                    options={[
                        { key: 'none', label: t('ops.desk.clientNone') },
                        { key: 'existing', label: t('ops.desk.clientExisting') },
                        { key: 'new', label: t('ops.desk.clientNew') },
                    ]}
                    value={clientMode}
                    onChange={setClientMode}
                    disabled={creating}
                    accessibilityLabel={t('ops.desk.client')}
                    testID="desk-client-mode"
                />
                {clientMode === 'existing' ? (
                    <>
                        <Input
                            value={searchQ}
                            onChangeText={(value) => { setSearchQ(value); setSelectedClientId(''); }}
                            placeholder={t('ops.desk.searchPlaceholder')}
                            accessibilityLabel={t('ops.desk.searchPlaceholder')}
                            leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                            autoCapitalize="none"
                            autoCorrect={false}
                            containerStyle={styles.flush}
                            testID="desk-client-search"
                        />
                        {searchLoading ? <Text style={ui.muted}>{t('ops.desk.searching')}</Text> : null}
                        {search.error && !searchLoading ? <Text style={[ui.muted, styles.danger]}>{t('ops.desk.errors.searchFailed')}</Text> : null}
                        {!searchLoading && !search.error && debouncedQ && foundUsers.length === 0 ? <Text style={ui.muted}>{t('ops.desk.notFound')}</Text> : null}
                        {foundUsers.length > 0 ? (
                            <ListGroup testID="desk-client-found">
                                {foundUsers.map((user) => {
                                    const selected = user.id === selectedClientId;
                                    return (
                                        <ListRow
                                            key={user.id}
                                            leading={<Avatar name={user.full_name} size={40} ring={selected} />}
                                            title={user.full_name}
                                            subtitle={[user.phone, user.email].filter(Boolean).join(' · ') || undefined}
                                            trailing={selected ? <Ionicons name="checkmark-circle" size={22} color={colors.tone.success.fg} /> : undefined}
                                            chevron={false}
                                            onPress={() => setSelectedClientId(user.id)}
                                            disabled={creating}
                                            testID={`desk-client-found-${user.id}`}
                                        />
                                    );
                                })}
                            </ListGroup>
                        ) : null}
                        {selectedClient ? (
                            <ListGroup>
                                <ListRow
                                    icon="pricetags-outline"
                                    iconTone="success"
                                    title={t('ops.packages.sell.button')}
                                    subtitle={t('ops.desk.clientMode.found')}
                                    onPress={() => setSellOpen(true)}
                                />
                            </ListGroup>
                        ) : null}
                    </>
                ) : null}
                {clientMode === 'new' ? (
                    <View>
                        <FormField
                            label={t('ops.desk.clientName')}
                            required
                            value={newClientName}
                            onChangeText={setNewClientName}
                            autoCapitalize="words"
                            testID="desk-client-name"
                        />
                        <FormField
                            label={t('ops.desk.clientPhone')}
                            required
                            value={newClientPhone}
                            onChangeText={setNewClientPhone}
                            placeholder="+996"
                            keyboardType="phone-pad"
                            testID="desk-client-phone"
                        />
                    </View>
                ) : null}
            </Section>

            {selectedClient ? (
                <SellPackageModal
                    bizId={bizId}
                    visible={sellOpen}
                    clientId={selectedClient.id}
                    clientName={selectedClient.full_name}
                    onClose={() => setSellOpen(false)}
                />
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    flush: { marginBottom: 0 },
    danger: { color: colors.tone.danger.fg },
});
