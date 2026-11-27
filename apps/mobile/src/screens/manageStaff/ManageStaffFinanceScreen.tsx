import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import SegmentedTabs from '../../components/SegmentedTabs';
import Avatar from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ChipGroup from '../../components/ui/ChipGroup';
import { DateNavigator } from '../../components/ui/DateTimeFields';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField, { FieldRow } from '../../components/ui/FormField';
import Input from '../../components/ui/Input';
import ListRow, { KeyValueRow, ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { StatGrid } from '../../components/ui/StatTile';
import { colors } from '../../constants/colors';
import { radii, space } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { businessTodayYmd } from '../../utils/businessWeek';
import { closeManagedShift, fetchManagedFinance, openManagedShift, saveManagedShiftItems } from './api';
import { staffErrorMessage } from './errors';
import {
    bookingServiceName,
    formatAmount,
    guaranteeLine,
    serviceTitle,
    shiftCalculations,
    shiftItemFromDraft,
    shiftSummaryAmounts,
    wireShiftItems,
    type ShiftItemDraft,
} from './financeView';
import { staffQueryKeys } from './queryKeys';
import type { ManagedFinancePayload, ManagedShiftItem } from './types';
import { Badge, OptionList, StatTile, ui } from './ui';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ManageStaffFinance'>;
type Editor = { index: number | null; draft: ShiftItemDraft };

const emptyDraft: ShiftItemDraft = { clientName: '', serviceName: '', serviceAmount: '', consumablesAmount: '', bookingId: null };

/** "Клиент N" for a walk-in, avoiding the names already used in the shift (ClientEditForm). */
export function nextAutoClientName(items: ManagedShiftItem[], label: string, exceptIndex: number | null): string {
    const used = new Set(items.filter((_, index) => index !== exceptIndex).map((item) => item.clientName).filter(Boolean));
    let next = 1;
    while (used.has(`${label} ${next}`)) next += 1;
    return `${label} ${next}`;
}

/**
 * /dashboard/staff/[id]/finance: the manager's shift workspace for one staff member and day. Open,
 * close and reopen the shift, and keep its client entries; every write is the website's
 * revision-checked command, and every total is the server's ledger or the shared finance domain.
 */
export default function ManageStaffFinanceScreen() {
    const navigation = useNavigation<Navigation>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageStaffFinance'>>();
    const { t, locale } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [date, setDate] = useState<string | null>(null);
    const [tab, setTab] = useState<'shift' | 'clients'>('shift');
    const [showDetails, setShowDetails] = useState(false);
    const [busy, setBusy] = useState<'open' | 'close' | 'save' | null>(null);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [editorError, setEditorError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const finance = useQuery({
        queryKey: staffQueryKeys.finance(params.bizId, params.staffId, date),
        queryFn: () => fetchManagedFinance(params.bizId, params.staffId, date),
    });
    const data: ManagedFinancePayload | undefined = finance.data;
    const shift = data?.today.shift ?? null;
    const status = data?.today.status ?? 'none';
    const items = useMemo(() => data?.today.items ?? [], [data]);
    const isOpen = status === 'open';
    const isClosed = status === 'closed';
    const calendarDate = data?.calendar?.date ?? shift?.shift_date ?? date;
    const timezone = data?.calendar?.timezone;
    const autoClientLabel = t('manageStaff.staff.finance.clients.client');

    const calculations = useMemo(() => shiftCalculations(
        items, shift, isOpen, data?.staffPercentMaster ?? 60, data?.staffPercentSalon ?? 40, data?.currentGuaranteedAmount ?? null,
    ), [items, shift, isOpen, data]);
    const revenue = shiftSummaryAmounts(calculations);
    const guarantee = guaranteeLine(shift, isOpen, data?.hourlyRate ?? null, data?.currentHoursWorked ?? null, data?.currentGuaranteedAmount ?? null);
    const money = (value: number) => t('manageStaff.finance.money', { amount: formatAmount(value, locale) });

    const serviceOptions = useMemo(() => {
        const names = new Set<string>();
        for (const service of data?.services ?? []) {
            const name = serviceTitle(service, locale).trim();
            if (name) names.add(name);
        }
        for (const booking of data?.bookings ?? []) {
            for (const name of bookingServiceName(booking, locale).split(' + ')) if (name.trim()) names.add(name.trim());
        }
        return [...names];
    }, [data, locale]);

    const reload = async () => { await queryClient.invalidateQueries({ queryKey: staffQueryKeys.finance(params.bizId, params.staffId, date) }); };
    const refresh = async () => {
        setRefreshing(true);
        try { await finance.refetch(); } finally { setRefreshing(false); }
    };

    const changeDate = (next: string) => {
        if (editor || busy) { showToast(t('manageStaff.staff.finance.draft.saveOrDiscardFirst'), 'error'); return; }
        setDate(next);
    };

    const openShift = async () => {
        if (isClosed) {
            const accepted = await confirm({
                title: t('manageStaff.staff.finance.shift.reopen'),
                message: t('manageStaff.reopenConfirm'),
                confirmLabel: t('manageStaff.staff.finance.shift.reopen'),
                cancelLabel: t('manageStaff.common.cancel'),
            });
            if (!accepted) return;
        }
        setBusy('open');
        try {
            await openManagedShift(params.bizId, params.staffId, calendarDate ?? null);
            showToast(t('manageStaff.shiftOpened'), 'success');
        } catch (error) {
            showToast(staffErrorMessage(error, t('manageStaff.actionFailed'), t), 'error');
        } finally {
            setBusy(null);
            await reload();
        }
    };

    const closeShift = async () => {
        if (!shift) return;
        const accepted = await confirm({
            title: t('manageStaff.staff.finance.shift.close'),
            message: t('manageStaff.closeConfirm', { amount: money(revenue.total) }),
            confirmLabel: t('manageStaff.staff.finance.shift.close'),
            cancelLabel: t('manageStaff.common.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setBusy('close');
        try {
            const wire = wireShiftItems(items);
            await closeManagedShift(params.bizId, params.staffId, calendarDate ?? null, wire,
                wire.reduce((sum, item) => sum + (item.serviceAmount ?? 0), 0),
                { expectedShiftId: shift.id, expectedRevision: shift.ledger_revision });
            showToast(t('manageStaff.shiftClosed'), 'success');
        } catch (error) {
            showToast(staffErrorMessage(error, t('manageStaff.actionFailed'), t), 'error');
        } finally {
            setBusy(null);
            await reload();
        }
    };

    /** The whole ledger is one revision-checked command; a conflict reloads the current shift. */
    const saveItems = async (next: ManagedShiftItem[]): Promise<boolean> => {
        if (!shift || !isOpen) return false;
        setBusy('save');
        try {
            await saveManagedShiftItems(params.bizId, params.staffId, calendarDate ?? null, wireShiftItems(next),
                { expectedShiftId: shift.id, expectedRevision: shift.ledger_revision });
            showToast(t('manageStaff.saved'), 'success');
            return true;
        } catch (error) {
            showToast(staffErrorMessage(error, t('manageStaff.staff.finance.write.unconfirmed'), t), 'error');
            return false;
        } finally {
            setBusy(null);
            await reload();
        }
    };

    const startEdit = (index: number | null, source?: ManagedShiftItem, copy = false) => {
        setEditorError(null);
        setEditor({
            index: copy ? null : index,
            draft: source ? {
                clientName: source.clientName,
                serviceName: source.serviceName,
                serviceAmount: source.serviceAmount ? String(source.serviceAmount) : '',
                consumablesAmount: source.consumablesAmount ? String(source.consumablesAmount) : '',
                bookingId: copy ? null : source.bookingId ?? null,
            } : emptyDraft,
        });
    };

    const saveEditor = async () => {
        if (!editor) return;
        const label = nextAutoClientName(items, autoClientLabel, editor.index);
        const result = shiftItemFromDraft(editor.draft, label);
        if (!result.ok) { setEditorError(t('manageStaff.staff.finance.validation.errors')); return; }
        const next = [...items];
        if (editor.index === null) next.push(result.item);
        else next[editor.index] = { ...next[editor.index], ...result.item };
        if (await saveItems(next)) setEditor(null);
    };

    const deleteItem = async (index: number) => {
        const item = items[index];
        const accepted = await confirm({
            title: t('manageStaff.deleteClientTitle'),
            message: t('manageStaff.deleteClientMessage', { name: item?.clientName || autoClientLabel }),
            confirmLabel: t('manageStaff.deleteClientConfirm'),
            cancelLabel: t('manageStaff.common.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        await saveItems(items.filter((_, position) => position !== index));
    };

    const chooseBooking = (bookingId: string | null) => {
        if (!editor) return;
        const booking = bookingId ? data?.bookings?.find((item) => item.id === bookingId) : null;
        setEditor({
            ...editor,
            draft: {
                ...editor.draft,
                bookingId,
                clientName: booking ? booking.client_name || booking.client_phone || editor.draft.clientName : nextAutoClientName(items, autoClientLabel, editor.index),
                serviceName: booking ? bookingServiceName(booking, locale) || editor.draft.serviceName : editor.draft.serviceName,
            },
        });
    };

    const toggleService = (name: string) => {
        if (!editor || editor.draft.bookingId) return;
        const selected = editor.draft.serviceName.split('+').map((part) => part.trim()).filter(Boolean);
        const next = selected.includes(name) ? selected.filter((part) => part !== name) : [...selected, name];
        setEditor({ ...editor, draft: { ...editor.draft, serviceName: next.join(' + ') } });
    };

    if (finance.isLoading) {
        return (
            <Screen testID="manage-staff-finance-loading">
                <SkeletonCard lines={2} />
                <SkeletonCard lines={3} />
            </Screen>
        );
    }
    if (!data) {
        return (
            <Screen>
                <ErrorState
                    title={t('manageStaff.staff.finance.error.title')}
                    message={staffErrorMessage(finance.error, t('staff.checkConnection'), t)}
                    retryLabel={t('manageStaff.staff.finance.error.retry')}
                    onRetry={() => void finance.refetch()}
                />
            </Screen>
        );
    }

    const locked = !!busy || finance.isFetching;
    const statusLabel = t(isOpen ? 'manageStaff.staff.finance.shift.status.open' : isClosed ? 'manageStaff.staff.finance.shift.status.closed' : 'manageStaff.staff.finance.shift.status.notCreated');
    const selectedServices = editor ? editor.draft.serviceName.split('+').map((part) => part.trim()).filter(Boolean) : [];
    const serviceChips = editor ? serviceOptions : [];

    return (
        <Screen keyboard refreshing={refreshing} onRefresh={refresh} testID="manage-staff-finance">
            {/* The header says "Финансы": one muted line names the person. */}
            {params.staffName ? <ScreenIntro>{params.staffName}</ScreenIntro> : null}

            {finance.error ? (
                <FeedbackBanner
                    variant="danger"
                    title={t('manageStaff.staff.finance.error.title')}
                    message={staffErrorMessage(finance.error, t('manageStaff.loadError'), t)}
                    action={<Button title={t('manageStaff.staff.finance.error.retry')} onPress={() => void finance.refetch()} size="sm" variant="outline" />}
                    compact
                />
            ) : null}

            <Card variant="plain" padding="md" style={styles.shiftCard}>
                <View style={ui.row}>
                    <View style={styles.flex}>
                        <Text style={ui.label}>{t('manageStaff.staff.finance.shift.current')}</Text>
                        <Text style={ui.muted}>
                            {timezone ?? ''}
                            {isOpen && shift ? ` · ${t('manageStaff.staff.finance.shift.opened')}: ${shift.opened_at ? formatInTimeZone(new Date(shift.opened_at), timezone || 'UTC', 'HH:mm') : '—'}` : ''}
                        </Text>
                    </View>
                    <StatusPill label={statusLabel} tone={isOpen ? 'success' : isClosed ? 'neutral' : 'warning'} />
                </View>
                {calendarDate ? (
                    // The website steps the shift day by day; the date itself opens the calendar.
                    <DateNavigator
                        value={calendarDate}
                        onChange={(next) => {
                            if (next === businessTodayYmd(resolveBusinessTimeZone(timezone))) {
                                if (editor || busy) { showToast(t('manageStaff.staff.finance.draft.saveOrDiscardFirst'), 'error'); return; }
                                setDate(null);
                                return;
                            }
                            changeDate(next);
                        }}
                        timeZone={timezone}
                        disabled={locked}
                        testID="staff-finance-date"
                    />
                ) : (
                    <Text style={ui.text}>—</Text>
                )}
            </Card>

            <SegmentedTabs
                tabs={[
                    { key: 'shift', label: t('manageStaff.staff.finance.tabs.shift') },
                    { key: 'clients', label: `${t('manageStaff.staff.finance.tabs.clients')} (${items.length})` },
                ]}
                value={tab}
                onChange={setTab}
            />

            {tab === 'shift' ? (
                <>
                    {!shift ? (
                        data.isDayOff ? (
                            <FeedbackBanner variant="warning" message={t('manageStaff.staff.finance.shift.dayOff')} compact />
                        ) : (
                            <EmptyState
                                icon="play-circle-outline"
                                compact
                                title={t('manageStaff.staff.finance.shift.notCreated')}
                                action={<Button title={t('manageStaff.staff.finance.shift.open')} onPress={() => void openShift()} loading={busy === 'open'} disabled={locked} fullWidth />}
                            />
                        )
                    ) : null}

                    {shift ? (
                        <Section title={t('manageStaff.staff.finance.summary.title')}>
                            <StatGrid>
                                <StatTile
                                    label={t('manageStaff.finance.totalWithConsumables')}
                                    value={money(revenue.total)}
                                    hint={`${t('manageStaff.finance.servicesRevenue')}: ${money(revenue.services)} · ${t('manageStaff.finance.consumablesRevenue')}: ${money(revenue.consumables)}`}
                                />
                                <StatTile
                                    label={t('manageStaff.staff.finance.summary.toStaff')}
                                    value={money(calculations.masterShare)}
                                    hint={guarantee !== null ? `${t('manageStaff.staff.finance.shift.guaranteedPayment')}: ${money(guarantee)}` : undefined}
                                    tone="success"
                                />
                                <StatTile label={t('manageStaff.staff.finance.summary.toBusiness')} value={money(calculations.salonShare)} tone="accent" />
                            </StatGrid>
                            {showDetails ? (
                                <Card variant="plain" padding="md" style={styles.details}>
                                    <Text style={ui.label}>{t('manageStaff.staff.finance.details.composition')}</Text>
                                    <KeyValueRow label={t('manageStaff.staff.finance.details.serviceAmount')} value={money(calculations.totalAmount)} />
                                    <KeyValueRow label={t('manageStaff.staff.finance.details.consumables')} value={money(calculations.totalConsumables)} />
                                    <KeyValueRow label={t('manageStaff.staff.finance.details.total')} value={money(calculations.totalAmount + calculations.totalConsumables)} emphasis />
                                    <View style={ui.divider} />
                                    <Text style={ui.label}>{t('manageStaff.staff.finance.details.distribution')}</Text>
                                    <KeyValueRow label={t('manageStaff.staff.finance.details.staffShare', { percent: String(data.staffPercentMaster ?? 60) })} value={money(calculations.masterShare)} tone="success" />
                                    <KeyValueRow
                                        label={t('manageStaff.staff.finance.details.businessShare', { percent: String(data.staffPercentSalon ?? 40) })}
                                        value={money(calculations.salonShare)}
                                        tone="accent"
                                    />
                                </Card>
                            ) : null}
                            <Button
                                title={t(showDetails ? 'manageStaff.staff.finance.shift.hideDetails' : 'manageStaff.staff.finance.shift.showDetails')}
                                onPress={() => setShowDetails((value) => !value)}
                                variant="ghost"
                                size="sm"
                                trailingIcon={<Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text.primary} />}
                            />
                        </Section>
                    ) : null}

                    {isOpen ? (
                        <View style={styles.shiftActions}>
                            <Button title={t('manageStaff.staff.finance.shift.refresh')} onPress={() => void refresh()} disabled={locked} variant="outline" style={styles.secondary} />
                            <Button title={t('manageStaff.staff.finance.shift.close')} onPress={() => void closeShift()} loading={busy === 'close'} disabled={locked} style={styles.primary} />
                        </View>
                    ) : null}
                    {isClosed && shift ? (
                        <Button title={t('manageStaff.staff.finance.shift.reopen')} onPress={() => void openShift()} loading={busy === 'open'} disabled={locked} variant="outline" fullWidth />
                    ) : null}
                </>
            ) : (
                <Section>
                    {!shift ? <Text style={ui.muted}>{t('manageStaff.staff.finance.shift.notCreated')}</Text> : null}
                    {isClosed ? <FeedbackBanner variant="info" message={t('manageStaff.closedReadOnly')} compact /> : null}
                    {isOpen && !editor ? (
                        <Button
                            title={t('manageStaff.staff.finance.clients.add')}
                            onPress={() => startEdit(null)}
                            disabled={locked}
                            leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
                            fullWidth
                        />
                    ) : null}

                    {editor ? (
                        <View style={ui.card}>
                            <Text style={ui.sectionTitle}>{t('manageStaff.staff.finance.clients.editing')}</Text>
                            {editorError ? <FeedbackBanner variant="danger" message={editorError} compact /> : null}
                            {(data.bookings ?? []).length > 0 ? (
                                <>
                                    <Text style={ui.label}>{t('manageStaff.staff.finance.clients.client')}</Text>
                                    <OptionList
                                        options={[
                                            { value: '', label: t('manageStaff.staff.finance.clients.selectFromBookings') },
                                            ...(data.bookings ?? []).map((booking) => ({
                                                value: booking.id,
                                                label: booking.client_name || booking.client_phone || t('manageStaff.staff.finance.clients.client'),
                                                hint: `${formatInTimeZone(new Date(booking.start_at), timezone || 'UTC', 'HH:mm')} · ${bookingServiceName(booking, locale)}`,
                                            })),
                                        ] as { value: string; label: string; hint?: string }[]}
                                        value={editor.draft.bookingId ?? ''}
                                        onChange={(value) => chooseBooking(value || null)}
                                        disabled={locked}
                                    />
                                </>
                            ) : null}
                            {!editor.draft.bookingId ? (
                                <FormField
                                    label={t('manageStaff.staff.finance.clients.client')}
                                    value={editor.draft.clientName}
                                    onChangeText={(value) => setEditor({ ...editor, draft: { ...editor.draft, clientName: value } })}
                                    placeholder={t('manageStaff.staff.finance.clients.clientPlaceholder')}
                                    hint={t('manageStaff.staff.finance.clients.walkInHint')}
                                    editable={!locked}
                                    containerStyle={styles.field}
                                />
                            ) : null}
                            <Text style={ui.label}>{t('manageStaff.staff.finance.clients.service')}</Text>
                            {!editor.draft.bookingId && serviceChips.length > 0 ? (
                                <ChipGroup
                                    multiple
                                    options={serviceChips.map((name) => ({ key: name, label: name }))}
                                    value={selectedServices.filter((name) => serviceChips.includes(name))}
                                    onChange={(next) => {
                                        const current = selectedServices.filter((name) => serviceChips.includes(name));
                                        const toggled = next.find((name) => !current.includes(name)) ?? current.find((name) => !next.includes(name));
                                        if (toggled) toggleService(toggled);
                                    }}
                                    disabled={locked}
                                    accessibilityLabel={t('manageStaff.staff.finance.clients.service')}
                                />
                            ) : null}
                            <Input
                                value={editor.draft.serviceName}
                                onChangeText={(value) => setEditor({ ...editor, draft: { ...editor.draft, serviceName: value } })}
                                accessibilityLabel={t('manageStaff.staff.finance.clients.service')}
                                editable={!locked}
                                containerStyle={styles.field}
                            />
                            <FieldRow>
                                <FormField
                                    label={t('manageStaff.form.price')}
                                    value={editor.draft.serviceAmount}
                                    onChangeText={(value) => setEditor({ ...editor, draft: { ...editor.draft, serviceAmount: value } })}
                                    keyboardType="decimal-pad"
                                    suffix={t('manageStaff.staff.finance.shift.som')}
                                    placeholder="0"
                                    editable={!locked}
                                    containerStyle={styles.field}
                                />
                                <FormField
                                    label={t('manageStaff.form.consumables')}
                                    value={editor.draft.consumablesAmount}
                                    onChangeText={(value) => setEditor({ ...editor, draft: { ...editor.draft, consumablesAmount: value } })}
                                    keyboardType="decimal-pad"
                                    suffix={t('manageStaff.staff.finance.shift.som')}
                                    placeholder="0"
                                    editable={!locked}
                                    containerStyle={styles.field}
                                />
                            </FieldRow>
                            <Text style={ui.muted}>{t('manageStaff.staff.finance.clients.amountHint')}</Text>
                            <View style={styles.shiftActions}>
                                <Button title={t('manageStaff.staff.finance.clients.cancel')} onPress={() => setEditor(null)} disabled={!!busy} variant="ghost" style={styles.secondary} />
                                <Button
                                    title={t(busy === 'save' ? 'manageStaff.staff.finance.clients.saving' : 'manageStaff.staff.finance.clients.save')}
                                    onPress={() => void saveEditor()}
                                    loading={busy === 'save'}
                                    disabled={locked}
                                    style={styles.primary}
                                />
                            </View>
                        </View>
                    ) : null}

                    {items.length === 0 && shift ? (
                        <EmptyState icon="people-outline" compact title={t('manageStaff.staff.finance.clients.empty')} />
                    ) : null}
                    {items.length > 0 ? (
                        <View style={styles.items}>
                            {items.map((item, index) => (
                                <View key={item.id ?? `new-${index}`} style={styles.item}>
                                    <ListRow
                                        leading={<Avatar name={item.clientName || autoClientLabel} size={40} />}
                                        title={item.clientName || autoClientLabel}
                                        subtitle={[
                                            item.serviceName || '—',
                                            item.consumablesAmount ? `${t('manageStaff.staff.finance.details.consumables')}: ${money(item.consumablesAmount)}` : null,
                                        ].filter(Boolean).join(' · ')}
                                        value={money(item.serviceAmount)}
                                        trailing={item.bookingId ? <Badge label={t('manageStaff.staff.finance.clients.fromBooking')} tone="accent" /> : undefined}
                                    />
                                    {isOpen && !editor ? (
                                        <View style={styles.itemActions}>
                                            <Button title={t('manageStaff.staff.finance.clients.edit')} onPress={() => startEdit(index, item)} disabled={locked} variant="ghost" size="sm" />
                                            <Button title={t('manageStaff.staff.finance.clients.duplicate')} onPress={() => startEdit(index, item, true)} disabled={locked} variant="ghost" size="sm" />
                                            <Button title={t('manageStaff.staff.finance.clients.delete')} onPress={() => void deleteItem(index)} disabled={locked} variant="ghost" size="sm" textStyle={styles.dangerText} />
                                        </View>
                                    ) : null}
                                </View>
                            ))}
                        </View>
                    ) : null}
                </Section>
            )}

            <ListGroup>
                <ListRow
                    icon="stats-chart-outline"
                    iconTone="info"
                    title={t('manageStaff.finance.staffStats.title')}
                    onPress={() => navigation.navigate('ManageStaffFinanceStats', { ...params })}
                />
            </ListGroup>
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, gap: space.xxs },
    shiftCard: { gap: space.md },
    details: { gap: space.xxs },
    shiftActions: { flexDirection: 'row', gap: space.md },
    secondary: { flex: 1 },
    primary: { flex: 2 },
    field: { marginBottom: 0 },
    items: { gap: space.sm },
    item: { backgroundColor: colors.surface.card, borderRadius: radii.lg, paddingHorizontal: space.lg, paddingBottom: space.xs },
    itemActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: space.xs,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
        paddingTop: space.xs,
    },
    dangerText: { color: colors.tone.danger.fg },
});
