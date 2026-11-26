import { useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Badge, { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField, { FieldRow } from '../../components/ui/FormField';
import { KeyValueRow, ListGroup } from '../../components/ui/ListRow';
import OfflineBanner from '../../components/ui/OfflineBanner';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import StatTile, { StatGrid } from '../../components/ui/StatTile';
import { colors } from '../../constants/colors';
import { layout, radii, space, typeScale } from '../../constants/theme';
import { translatePlural, useLanguage, type Translate } from '../../i18n';
import { formatDate, formatPrice, formatTime } from '../../utils/format';
import type { FinanceData, ShiftItem, ShiftQuickMetrics } from './types';

type AddClientFormState = {
    showAddClient: boolean;
    editingItemIndex?: number | null;
    newClientName: string;
    newServiceName: string;
    newServiceAmount: string;
    newConsumablesAmount: string;
    error?: string | null;
};

type AddClientFormActions = {
    setShowAddClient: (value: boolean) => void;
    setNewClientName: (value: string) => void;
    setNewServiceName: (value: string) => void;
    setNewServiceAmount: (value: string) => void;
    setNewConsumablesAmount: (value: string) => void;
    resetForm: () => void;
    submit: () => void;
};

type ShiftQuickSectionsProps = {
    financeData: FinanceData;
    refreshing: boolean;
    isProcessingQueue: boolean;
    pendingQueueCount: number;
    commandsBlocked?: boolean;
    savingBlocked?: boolean;
    reviewMessage?: string;
    reviewItems?: ShiftItem[];
    onRestoreDraft?: () => void;
    onDiscardDraft?: () => void;
    isOpening: boolean;
    isClosing: boolean;
    isAddingClient: boolean;
    metrics: ShiftQuickMetrics;
    addClientForm: AddClientFormState;
    addClientActions: AddClientFormActions;
    onRefresh: () => Promise<void>;
    onOpenShift: () => void;
    onCloseShift: () => void;
    onEditClient: (item: ShiftItem, itemIndex: number) => void;
    /** S4: remove a manually added client (with confirmation in the screen). */
    onDeleteClient?: (item: ShiftItem) => void;
    deletingClient?: boolean;
};

type ShiftStatusMeta = {
    label: string;
    description: string;
    state: 'open' | 'closed' | 'idle';
};

/**
 * The master's shift of today: its state with the one main action (open the shift, then add a
 * client), the live numbers, the clients of the shift, and closing the shift separated at the end.
 */
export function ShiftQuickSections({
    financeData,
    refreshing,
    isProcessingQueue,
    pendingQueueCount,
    commandsBlocked, savingBlocked, reviewMessage, reviewItems, onRestoreDraft, onDiscardDraft,
    isOpening,
    isClosing,
    isAddingClient,
    metrics,
    addClientForm,
    addClientActions,
    onRefresh,
    onOpenShift,
    onCloseShift,
    onEditClient,
    onDeleteClient,
    deletingClient,
}: ShiftQuickSectionsProps) {
    const { t, locale } = useLanguage();
    const money = (amount: number) => formatPrice(amount, locale);
    const shift = financeData.today.shift;
    const items = financeData.today.items || [];
    const isOpen = shift?.status === 'open';
    const shiftMeta = getShiftStatusMeta(isOpen, !!shift, t);
    const isEditingClient = addClientForm.editingItemIndex != null;
    const formLocked = !!savingBlocked || isAddingClient;
    const scrollRef = useRef<ScrollView>(null);
    const serviceInputRef = useRef<TextInput>(null);
    const amountInputRef = useRef<TextInput>(null);
    const consumablesInputRef = useRef<TextInput>(null);
    const revealActiveField = () => {
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    };
    const som = t('staff.unit.som');

    return (
        <KeyboardAvoidingView
            style={styles.page}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView
            ref={scrollRef}
            style={styles.page}
            contentContainerStyle={styles.content}
            refreshControl={(
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void onRefresh()}
                    tintColor={colors.accent.indigo}
                    colors={[colors.accent.indigo]}
                    progressBackgroundColor={colors.surface.card}
                />
            )}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            onContentSizeChange={() => {
                if (addClientForm.showAddClient) {
                    revealActiveField();
                }
            }}
        >
            {/* The header says "Моя смена": the screen starts with today's date. */}
            <ScreenIntro>{formatDate(new Date(), locale)}</ScreenIntro>

            {financeData.isDayOff && !isOpen && !shift ? (
                <FeedbackBanner
                    variant="warning"
                    title={t('staff.shiftQuick.dayOffTitle')}
                    message={t('staff.shiftQuick.dayOffMessage')}
                    compact
                />
            ) : null}

            <Card variant={isOpen ? 'accent' : 'plain'} padding="md" style={styles.status}>
                <View style={styles.statusTop}>
                    <View
                        style={[
                            styles.statusIcon,
                            shiftMeta.state === 'open' ? styles.statusIconOpen : shiftMeta.state === 'closed' ? styles.statusIconClosed : null,
                        ]}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                    >
                        <Ionicons
                            name={shiftMeta.state === 'open' ? 'play' : shiftMeta.state === 'closed' ? 'checkmark-done' : 'time-outline'}
                            size={20}
                            color={shiftMeta.state === 'open' ? colors.tone.success.fg : shiftMeta.state === 'closed' ? colors.text.secondary : colors.tone.accent.fg}
                        />
                    </View>
                    <View style={styles.statusText} accessibilityRole="text" accessibilityLiveRegion="polite">
                        <Text style={styles.statusLabel}>{shiftMeta.label}</Text>
                        {/* On a day off the banner above explains it; "open the shift" would contradict it. */}
                        {financeData.isDayOff && !isOpen && !shift ? null : <Text style={styles.statusDescription}>{shiftMeta.description}</Text>}
                    </View>
                    <StatusPill
                        label={t(isOpen ? 'staff.status.open' : shift ? 'staff.status.closed' : 'staff.shiftQuick.notStarted')}
                        tone={isOpen ? 'success' : 'neutral'}
                    />
                </View>

                <View style={styles.timeline}>
                    <KeyValueRow label={t('staff.shiftQuick.openedAt')} value={shift?.opened_at ? formatTime(shift.opened_at) : '—'} />
                    <KeyValueRow
                        label={t('staff.shiftQuick.worked')}
                        value={isOpen && financeData.currentHoursWorked != null
                            ? t('staff.hours', { hours: financeData.currentHoursWorked.toFixed(1) })
                            : '—'}
                    />
                </View>

                {pendingQueueCount > 0 && !reviewMessage ? (
                    <FeedbackBanner
                        variant="info"
                        compact
                        title={
                            isProcessingQueue
                                ? t('staff.shiftQuick.syncingOperations')
                                : translatePlural(t, 'staff.shiftQuick.operationsQueued', pendingQueueCount)
                        }
                        message={
                            isProcessingQueue
                                ? t('staff.shiftQuick.syncingWait')
                                : t('staff.shiftQuick.draftSaved')
                        }
                    />
                ) : null}

                {!isOpen && !shift && !financeData.isDayOff ? (
                    <Button
                        title={t('staff.shiftQuick.openShift')}
                        onPress={onOpenShift}
                        disabled={commandsBlocked || isOpening || financeData.isDayOff}
                        loading={isOpening}
                        size="lg"
                        fullWidth
                        leadingIcon={<Ionicons name="play" size={18} color={colors.text.light} />}
                    />
                ) : null}
            </Card>

            {isOpen ? (
                <Section title={t('staff.shiftQuick.metrics')}>
                    <StatGrid>
                        <StatTile label={t('staff.turnover')} value={money(metrics.totalAmount)} icon="wallet-outline" />
                        <StatTile
                            label={t('staff.shiftQuick.master')}
                            value={money(metrics.finalMasterShare)}
                            hint={
                                metrics.currentGuaranteed > metrics.baseMasterShare
                                    ? t('staff.shiftQuick.guarantee', { amount: money(metrics.currentGuaranteed) })
                                    : undefined
                            }
                            icon="trending-up-outline"
                            tone="success"
                        />
                        <StatTile label={t('staff.shiftQuick.salon')} value={money(metrics.finalSalonShare)} icon="business-outline" />
                        <StatTile label={t('staff.shiftQuick.clients')} value={String(items.length)} icon="people-outline" />
                    </StatGrid>
                </Section>
            ) : null}

            {isOpen ? (
                !addClientForm.showAddClient ? (
                    <Button
                        title={t('staff.shiftQuick.addClient')}
                        disabled={commandsBlocked}
                        onPress={() => addClientActions.setShowAddClient(true)}
                        size="lg"
                        fullWidth
                        leadingIcon={<Ionicons name="add" size={20} color={colors.text.light} />}
                    />
                ) : (
                    <Section title={t(isEditingClient ? 'staff.shiftQuick.editTitle' : 'staff.shiftQuick.addTitle')}>
                        <Card variant="plain" padding="md" style={styles.form}>
                            {addClientForm.error ? (
                                <FeedbackBanner
                                    variant="danger"
                                    compact
                                    title={t('staff.shiftQuick.checkForm')}
                                    message={addClientForm.error}
                                    style={styles.formBanner}
                                />
                            ) : null}
                            <FormField
                                placeholder={t('staff.shiftQuick.clientNamePlaceholder')}
                                editable={!formLocked}
                                value={addClientForm.newClientName}
                                onChangeText={addClientActions.setNewClientName}
                                autoFocus
                                error={addClientForm.error ?? undefined}
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onFocus={revealActiveField}
                                onSubmitEditing={() => serviceInputRef.current?.focus()}
                            />
                            <FormField
                                ref={serviceInputRef}
                                placeholder={t('staff.service')}
                                editable={!formLocked}
                                value={addClientForm.newServiceName}
                                onChangeText={addClientActions.setNewServiceName}
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onFocus={revealActiveField}
                                onSubmitEditing={() => amountInputRef.current?.focus()}
                            />
                            <FieldRow>
                                <FormField
                                    ref={amountInputRef}
                                    placeholder={t('staff.shiftQuick.amountPlaceholder')}
                                    accessibilityLabel={`${t('staff.shiftQuick.amountPlaceholder')}, ${som}`}
                                    suffix={som}
                                    editable={!formLocked}
                                    value={addClientForm.newServiceAmount}
                                    onChangeText={addClientActions.setNewServiceAmount}
                                    keyboardType="numeric"
                                    returnKeyType="next"
                                    blurOnSubmit={false}
                                    onFocus={revealActiveField}
                                    onSubmitEditing={() => consumablesInputRef.current?.focus()}
                                />
                                <FormField
                                    ref={consumablesInputRef}
                                    placeholder={t('staff.consumables')}
                                    accessibilityLabel={`${t('staff.consumables')}, ${som}`}
                                    suffix={som}
                                    editable={!formLocked}
                                    value={addClientForm.newConsumablesAmount}
                                    onChangeText={addClientActions.setNewConsumablesAmount}
                                    keyboardType="numeric"
                                    returnKeyType="done"
                                    onFocus={revealActiveField}
                                    onSubmitEditing={() => {
                                        if (!formLocked && addClientForm.newClientName.trim()) {
                                            addClientActions.submit();
                                        }
                                    }}
                                />
                            </FieldRow>
                            <View style={styles.formActions}>
                                <Button
                                    title={t('staff.cancel')}
                                    onPress={addClientActions.resetForm}
                                    variant="outline"
                                    style={styles.formCancel}
                                />
                                <Button
                                    title={t(isEditingClient ? 'staff.shiftQuick.saveChanges' : 'staff.shiftQuick.save')}
                                    onPress={addClientActions.submit}
                                    disabled={formLocked || !addClientForm.newClientName.trim()}
                                    loading={isAddingClient}
                                    style={styles.formSave}
                                />
                            </View>
                        </Card>
                    </Section>
                )
            ) : null}

            {items.length > 0 ? (
                <Section title={t('staff.shiftQuick.clientsCount', { count: items.length })}>
                    <ListGroup>
                        {items.map((item, index) => (
                            <ClientRow
                                key={item.id || `${item.clientName}-${index}`}
                                item={item}
                                itemIndex={index}
                                canEdit={isOpen && !commandsBlocked && !deletingClient}
                                onEditClient={onEditClient}
                                onDeleteClient={onDeleteClient}
                            />
                        ))}
                    </ListGroup>
                </Section>
            ) : null}

            {isOpen && items.length === 0 && !addClientForm.showAddClient ? (
                <EmptyState
                    compact
                    icon="people-outline"
                    title={t('staff.shiftQuick.emptyTitle')}
                    message={t('staff.shiftQuick.emptyMessage')}
                />
            ) : null}

            {reviewMessage ? (
                <Card variant="plain" padding="md" style={styles.review}>
                    <FeedbackBanner variant="warning" title={t('staff.shiftQuick.reviewTitle')} message={reviewMessage} compact />
                    {reviewItems ? (
                        <View style={styles.reviewDraft}>
                            <Text style={styles.reviewTitle}>{t('staff.shiftQuick.reviewDraft')}</Text>
                            {reviewItems.map((item, index) => (
                                <Text key={item.id ?? index} style={styles.reviewLine}>
                                    {t('staff.shiftQuick.reviewLine', {
                                        client: item.clientName,
                                        service: item.serviceName,
                                        amount: money(item.serviceAmount),
                                        consumables: money(item.consumablesAmount),
                                    })}
                                </Text>
                            ))}
                        </View>
                    ) : null}
                    <Button title={t('staff.shiftQuick.loadCurrent')} onPress={() => void onRefresh()} disabled={isProcessingQueue} fullWidth />
                    {onRestoreDraft ? (
                        <Button title={t('staff.shiftQuick.restoreDraft')} onPress={onRestoreDraft} disabled={isProcessingQueue} variant="outline" fullWidth />
                    ) : null}
                    {onDiscardDraft ? (
                        <Button title={t('staff.shiftQuick.discardDraft')} variant="ghost" onPress={onDiscardDraft} disabled={isProcessingQueue} fullWidth textStyle={styles.dangerText} />
                    ) : null}
                </Card>
            ) : pendingQueueCount > 0 || isProcessingQueue ? (
                <OfflineBanner
                    compact
                    title={
                        isProcessingQueue
                            ? t('staff.shiftQuick.syncingQueue')
                            : t('staff.shiftQuick.offlineQueue', { count: pendingQueueCount })
                    }
                    message={
                        isProcessingQueue
                            ? t('staff.shiftQuick.syncingQueueMessage')
                            : t('staff.shiftQuick.queueMessage')
                    }
                    onRetry={() => void onRefresh()}
                />
            ) : null}

            {isOpen ? (
                // Closing ends the day's ledger: kept apart from the everyday actions at the end of the screen.
                <View style={styles.danger}>
                    <Button
                        title={t('staff.shiftQuick.closeShift')}
                        onPress={onCloseShift}
                        disabled={commandsBlocked || isClosing || addClientForm.showAddClient}
                        loading={isClosing}
                        variant="danger"
                        fullWidth
                        leadingIcon={<Ionicons name="stop" size={18} color={colors.text.light} />}
                    />
                </View>
            ) : null}
        </ScrollView>
        </KeyboardAvoidingView>
    );
}

/** One client of the shift: who, which service, the amount, where it came from, and its actions. */
function ClientRow({
    item,
    itemIndex,
    canEdit,
    onEditClient,
    onDeleteClient,
}: {
    item: ShiftItem;
    itemIndex: number;
    canEdit: boolean;
    onEditClient: (item: ShiftItem, itemIndex: number) => void;
    onDeleteClient?: (item: ShiftItem) => void;
}) {
    const { t, locale } = useLanguage();
    const canEditItem = canEdit && !item.bookingId;
    const fromBooking = !!item.bookingId;

    return (
        <View style={styles.client}>
            <View style={styles.clientTop}>
                <View style={[styles.clientIcon, fromBooking ? styles.clientIconBooking : null]}>
                    <Ionicons
                        name={fromBooking ? 'calendar-outline' : 'person-outline'}
                        size={18}
                        color={fromBooking ? colors.tone.success.fg : colors.tone.accent.fg}
                    />
                </View>
                <View style={styles.clientBody}>
                    <Text style={styles.clientName} numberOfLines={1}>{item.clientName || t('staff.client')}</Text>
                    {item.serviceName ? <Text style={styles.clientMeta} numberOfLines={1}>{item.serviceName}</Text> : null}
                    <View style={styles.clientTags}>
                        <Badge
                            label={t(fromBooking ? 'staff.shiftQuick.fromBooking' : 'staff.shiftQuick.addedManually')}
                            tone={fromBooking ? 'success' : 'neutral'}
                        />
                        {item.createdAt ? <Text style={styles.clientTime}>{formatTime(item.createdAt)}</Text> : null}
                    </View>
                </View>
                <View style={styles.clientAmounts}>
                    <Text style={styles.clientAmount}>{item.serviceAmount > 0 ? formatPrice(item.serviceAmount, locale) : '—'}</Text>
                    {item.consumablesAmount > 0 ? (
                        <Text style={styles.clientMeta}>
                            {t('staff.shiftQuick.itemConsumables', { amount: formatPrice(item.consumablesAmount, locale) })}
                        </Text>
                    ) : null}
                </View>
            </View>
            {canEditItem ? (
                <View style={styles.clientActions}>
                    <Button
                        title={t('staff.shiftQuick.edit')}
                        onPress={() => onEditClient(item, itemIndex)}
                        variant="ghost"
                        size="sm"
                        leadingIcon={<Ionicons name="create-outline" size={16} color={colors.tone.accent.fg} />}
                        accessibilityLabel={t('staff.shiftQuick.edit')}
                    />
                    {item.id && onDeleteClient ? (
                        <Button
                            title={t('staff.shiftQuick.delete')}
                            onPress={() => onDeleteClient(item)}
                            variant="ghost"
                            size="sm"
                            leadingIcon={<Ionicons name="trash-outline" size={16} color={colors.tone.danger.fg} />}
                            textStyle={styles.dangerText}
                            accessibilityLabel={t('staff.shiftQuick.deleteA11y', { client: item.clientName || t('staff.client') })}
                        />
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

function getShiftStatusMeta(isOpen: boolean, hasShift: boolean, t: Translate): ShiftStatusMeta {
    if (isOpen) {
        return {
            label: t('staff.shiftQuick.activeLabel'),
            description: t('staff.shiftQuick.activeDescription'),
            state: 'open',
        };
    }

    if (hasShift) {
        return {
            label: t('staff.shiftQuick.closedLabel'),
            description: t('staff.shiftQuick.closedDescription'),
            state: 'closed',
        };
    }

    return {
        label: t('staff.shiftQuick.idleLabel'),
        description: t('staff.shiftQuick.idleDescription'),
        state: 'idle',
    };
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.surface.page },
    content: {
        paddingHorizontal: layout.gutter,
        paddingTop: space.lg,
        paddingBottom: space.huge,
        gap: layout.sectionGap,
    },
    status: { gap: space.lg },
    statusTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    statusIcon: {
        width: 44,
        height: 44,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.accent.bg,
    },
    statusIconOpen: { backgroundColor: colors.tone.success.bg },
    statusIconClosed: { backgroundColor: colors.tone.neutral.bg },
    statusText: { flex: 1, minWidth: 0, gap: space.xxs },
    statusLabel: { ...typeScale.headline, color: colors.text.primary },
    statusDescription: { ...typeScale.caption, color: colors.text.secondary },
    timeline: {
        paddingTop: space.xs,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    form: { gap: 0 },
    formBanner: { marginBottom: space.lg },
    formActions: { flexDirection: 'row', gap: space.md },
    formCancel: { flex: 1 },
    formSave: { flex: 2 },
    client: { paddingVertical: space.md, gap: space.xs },
    clientTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    clientIcon: {
        width: 36,
        height: 36,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.accent.bg,
    },
    clientIconBooking: { backgroundColor: colors.tone.success.bg },
    clientBody: { flex: 1, minWidth: 0, gap: space.xxs },
    clientName: { ...typeScale.bodyStrong, color: colors.text.primary },
    clientMeta: { ...typeScale.caption, color: colors.text.secondary },
    clientTags: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xxs },
    clientTime: { ...typeScale.caption, color: colors.text.tertiary },
    clientAmounts: { alignItems: 'flex-end', gap: space.xxs },
    clientAmount: { ...typeScale.bodyStrong, color: colors.text.primary },
    clientActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
    dangerText: { color: colors.tone.danger.fg },
    review: { gap: space.md },
    reviewDraft: { gap: space.xs },
    reviewTitle: { ...typeScale.bodyStrong, color: colors.text.primary },
    reviewLine: { ...typeScale.caption, color: colors.text.secondary },
    danger: {
        paddingTop: space.lg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
});
