import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import SegmentedTabs from '../../components/SegmentedTabs';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { DateNavigator } from '../../components/ui/DateTimeFields';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { colors } from '../../constants/colors';
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
import { Badge, Chip, OptionList, SectionTitle, StatTile, dmy, ui } from './ui';

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

    if (finance.isLoading) return <LoadingSpinner message={t('manageStaff.staff.finance.loading')} />;
    if (!data) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('manageStaff.staff.finance.error.title')}
                message={staffErrorMessage(finance.error, t('staff.checkConnection'), t)}
                action={<Button title={t('manageStaff.staff.finance.error.retry')} onPress={() => void finance.refetch()} variant="outline" fullWidth />}
            />
        );
    }

    const locked = !!busy || finance.isFetching;
    const statusLabel = t(isOpen ? 'manageStaff.staff.finance.shift.status.open' : isClosed ? 'manageStaff.staff.finance.shift.status.closed' : 'manageStaff.staff.finance.shift.status.notCreated');

    return (
        <ScrollView
            style={ui.container}
            contentContainerStyle={ui.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
            testID="manage-staff-finance"
        >
            <View>
                <Badge label={t('manageStaff.staff.finance.workspace')} tone="accent" />
                <Text style={[ui.title, styles.title]} accessibilityRole="header">{t('manageStaff.staff.finance.shift.title')}: {params.staffName ?? ''}</Text>
                <Text style={ui.muted}>{t('manageStaff.staff.finance.shift.subtitle')}</Text>
            </View>
            <Button
                title={t('manageStaff.finance.staffStats.title')}
                onPress={() => navigation.navigate('ManageStaffFinanceStats', { ...params })}
                variant="outline"
                fullWidth
            />

            {finance.error ? (
                <FeedbackBanner
                    variant="danger"
                    title={t('manageStaff.staff.finance.error.title')}
                    message={staffErrorMessage(finance.error, t('manageStaff.loadError'), t)}
                    action={<Button title={t('manageStaff.staff.finance.error.retry')} onPress={() => void finance.refetch()} size="sm" variant="outline" />}
                />
            ) : null}

            <SegmentedTabs
                tabs={[
                    { key: 'shift', label: t('manageStaff.staff.finance.tabs.shift') },
                    { key: 'clients', label: `${t('manageStaff.staff.finance.tabs.clients')} (${items.length})` },
                ]}
                value={tab}
                onChange={setTab}
            />

            <Card style={ui.gap}>
                <View style={ui.row}>
                    <View style={styles.flex}>
                        <Text style={ui.label}>{t('manageStaff.staff.finance.shift.current')}</Text>
                        <Text style={ui.text}>{calendarDate ? dmy(calendarDate) : '—'} {timezone ? `(${timezone})` : ''}</Text>
                    </View>
                    <Badge label={statusLabel} tone={isOpen ? 'success' : isClosed ? 'muted' : 'warning'} />
                </View>
                {isOpen && shift ? (
                    <Text style={ui.muted}>
                        {t('manageStaff.staff.finance.shift.opened')}: {shift.opened_at ? formatInTimeZone(new Date(shift.opened_at), timezone || 'UTC', 'HH:mm') : '—'}
                    </Text>
                ) : null}
                {status === 'none' ? <Text style={styles.warning}>{t('manageStaff.staff.finance.shift.notCreated')}</Text> : null}
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
                ) : null}
            </Card>

            {tab === 'shift' ? (
                <>
                    <View style={ui.gap}>
                        {!shift ? (
                            data.isDayOff ? (
                                <FeedbackBanner variant="warning" message={t('manageStaff.staff.finance.shift.dayOff')} />
                            ) : (
                                <Button title={t('manageStaff.staff.finance.shift.open')} onPress={() => void openShift()} loading={busy === 'open'} disabled={locked} fullWidth />
                            )
                        ) : null}
                        {isOpen ? (
                            <>
                                <Button title={t('manageStaff.staff.finance.shift.refresh')} onPress={() => void refresh()} disabled={locked} variant="outline" fullWidth />
                                <Button title={t('manageStaff.staff.finance.shift.close')} onPress={() => void closeShift()} loading={busy === 'close'} disabled={locked} fullWidth />
                            </>
                        ) : null}
                        {isClosed && shift ? (
                            <Button title={t('manageStaff.staff.finance.shift.reopen')} onPress={() => void openShift()} loading={busy === 'open'} disabled={locked} variant="outline" fullWidth />
                        ) : null}
                    </View>

                    {shift ? (
                        <Card style={ui.gap}>
                            <SectionTitle title={t('manageStaff.staff.finance.summary.title')} />
                            <View style={ui.wrap}>
                                <StatTile
                                    label={t('manageStaff.finance.totalWithConsumables')}
                                    value={money(revenue.total)}
                                    hint={`${t('manageStaff.finance.servicesRevenue')}: ${money(revenue.services)} · ${t('manageStaff.finance.consumablesRevenue')}: ${money(revenue.consumables)}`}
                                    style={styles.full}
                                />
                                <StatTile
                                    label={t('manageStaff.staff.finance.summary.toStaff')}
                                    value={money(calculations.masterShare)}
                                    hint={guarantee !== null ? `${t('manageStaff.staff.finance.shift.guaranteedPayment')}: ${guarantee.toFixed(2)} ${t('manageStaff.staff.finance.shift.som')}` : undefined}
                                    tone="success"
                                />
                                <StatTile label={t('manageStaff.staff.finance.summary.toBusiness')} value={money(calculations.salonShare)} tone="accent" />
                            </View>
                            {showDetails ? (
                                <View style={ui.gap}>
                                    <Text style={ui.label}>{t('manageStaff.staff.finance.details.composition')}</Text>
                                    <Row label={t('manageStaff.staff.finance.details.serviceAmount')} value={money(calculations.totalAmount)} />
                                    <Row label={t('manageStaff.staff.finance.details.consumables')} value={money(calculations.totalConsumables)} />
                                    <Row label={t('manageStaff.staff.finance.details.total')} value={money(calculations.totalAmount + calculations.totalConsumables)} strong />
                                    <Text style={ui.label}>{t('manageStaff.staff.finance.details.distribution')}</Text>
                                    <Row label={`${t('manageStaff.staff.finance.details.staffShare')} (${data.staffPercentMaster ?? 60}%)`} value={money(calculations.masterShare)} />
                                    <Row
                                        label={`${t('manageStaff.staff.finance.details.businessShare')} ${t('manageStaff.staff.finance.details.businessSharePercent', { percent: String(data.staffPercentSalon ?? 40) })}`}
                                        value={money(calculations.salonShare)}
                                    />
                                </View>
                            ) : null}
                            <Button
                                title={t(showDetails ? 'manageStaff.staff.finance.shift.hideDetails' : 'manageStaff.staff.finance.shift.showDetails')}
                                onPress={() => setShowDetails((value) => !value)}
                                variant="ghost"
                                size="sm"
                            />
                        </Card>
                    ) : null}
                </>
            ) : (
                <Card style={ui.gap}>
                    <SectionTitle title={t('manageStaff.staff.finance.tabs.clients')} />
                    {!shift ? <Text style={ui.muted}>{t('manageStaff.staff.finance.shift.notCreated')}</Text> : null}
                    {isClosed ? <Text style={ui.muted}>{t('manageStaff.closedReadOnly')}</Text> : null}
                    {isOpen && !editor ? (
                        <Button title={t('manageStaff.staff.finance.clients.add')} onPress={() => startEdit(null)} disabled={locked} fullWidth />
                    ) : null}

                    {editor ? (
                        <View style={styles.editor}>
                            <Text style={styles.editorTitle}>{t('manageStaff.staff.finance.clients.editing')}</Text>
                            {editorError ? <FeedbackBanner variant="danger" message={editorError} /> : null}
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
                                <Input
                                    label={`${t('manageStaff.staff.finance.clients.client')} (${t('manageStaff.staff.finance.clients.clientHint')})`}
                                    value={editor.draft.clientName}
                                    onChangeText={(value) => setEditor({ ...editor, draft: { ...editor.draft, clientName: value } })}
                                    placeholder={t('manageStaff.staff.finance.clients.clientPlaceholder')}
                                    helperText={t('manageStaff.staff.finance.clients.walkInHint')}
                                    editable={!locked}
                                />
                            ) : null}
                            <Text style={ui.label}>{t('manageStaff.staff.finance.clients.service')}</Text>
                            {!editor.draft.bookingId && serviceOptions.length > 0 ? (
                                <View style={ui.wrap}>
                                    {serviceOptions.map((name) => (
                                        <Chip
                                            key={name}
                                            label={name}
                                            selected={editor.draft.serviceName.split('+').map((part) => part.trim()).includes(name)}
                                            onPress={() => toggleService(name)}
                                            disabled={locked}
                                        />
                                    ))}
                                </View>
                            ) : null}
                            <Input
                                value={editor.draft.serviceName}
                                onChangeText={(value) => setEditor({ ...editor, draft: { ...editor.draft, serviceName: value } })}
                                accessibilityLabel={t('manageStaff.staff.finance.clients.service')}
                                editable={!locked}
                            />
                            <Input
                                label={`${t('manageStaff.staff.finance.clients.servicePrice')} (${t('manageStaff.staff.finance.shift.som')})`}
                                value={editor.draft.serviceAmount}
                                onChangeText={(value) => setEditor({ ...editor, draft: { ...editor.draft, serviceAmount: value } })}
                                keyboardType="decimal-pad"
                                helperText={t('manageStaff.staff.finance.clients.amountHint')}
                                editable={!locked}
                            />
                            <Input
                                label={`${t('manageStaff.staff.finance.clients.consumablesAmount')} (${t('manageStaff.staff.finance.shift.som')})`}
                                value={editor.draft.consumablesAmount}
                                onChangeText={(value) => setEditor({ ...editor, draft: { ...editor.draft, consumablesAmount: value } })}
                                keyboardType="decimal-pad"
                                helperText={t('manageStaff.staff.finance.clients.amountHint')}
                                editable={!locked}
                            />
                            <Button
                                title={t(busy === 'save' ? 'manageStaff.staff.finance.clients.saving' : 'manageStaff.staff.finance.clients.save')}
                                onPress={() => void saveEditor()}
                                loading={busy === 'save'}
                                disabled={locked}
                                fullWidth
                            />
                            <Button title={t('manageStaff.staff.finance.clients.cancel')} onPress={() => setEditor(null)} disabled={!!busy} variant="ghost" fullWidth />
                        </View>
                    ) : null}

                    {items.length === 0 && shift ? <Text style={ui.muted}>{t('manageStaff.staff.finance.clients.empty')}</Text> : null}
                    {items.map((item, index) => (
                        <View key={item.id ?? `new-${index}`} style={styles.item}>
                            <View style={ui.row}>
                                <Text style={[ui.text, styles.flex]} numberOfLines={1}>{item.clientName || autoClientLabel}</Text>
                                {item.bookingId ? <Badge label={t('manageStaff.staff.finance.clients.fromBooking')} tone="accent" /> : null}
                            </View>
                            <Text style={ui.muted}>{item.serviceName || '—'}</Text>
                            <Text style={ui.text}>
                                {money(item.serviceAmount)}{item.consumablesAmount ? ` · ${t('manageStaff.staff.finance.details.consumables')}: ${money(item.consumablesAmount)}` : ''}
                            </Text>
                            {isOpen && !editor ? (
                                <View style={ui.wrap}>
                                    <Button title={t('manageStaff.staff.finance.clients.edit')} onPress={() => startEdit(index, item)} disabled={locked} variant="outline" size="sm" />
                                    <Button title={t('manageStaff.staff.finance.clients.duplicate')} onPress={() => startEdit(index, item, true)} disabled={locked} variant="ghost" size="sm" />
                                    <Button title={t('manageStaff.staff.finance.clients.delete')} onPress={() => void deleteItem(index)} disabled={locked} variant="danger" size="sm" />
                                </View>
                            ) : null}
                        </View>
                    ))}
                </Card>
            )}
        </ScrollView>
    );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <View style={styles.detailRow}>
            <Text style={[ui.muted, styles.flex]}>{label}</Text>
            <Text style={[ui.text, strong ? styles.strong : null]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    title: { marginTop: colors.layout.space2 },
    flex: { flex: 1 },
    full: { flexBasis: '100%' },
    warning: { fontSize: 13, color: colors.status.warning },
    editor: {
        gap: colors.layout.space3,
        padding: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.accent.primary,
        backgroundColor: colors.surface.emphasis,
    },
    editorTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    item: {
        gap: colors.layout.space1,
        padding: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.card,
    },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: colors.layout.space2 },
    strong: { fontWeight: '700' },
});
