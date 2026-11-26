import { useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { colors } from '../../constants/colors';
import { translatePlural, useLanguage, type Translate } from '../../i18n';
import { formatDate, formatPrice, formatTime } from '../../utils/format';
import { styles } from './shiftQuickStyles';
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
    const scrollRef = useRef<ScrollView>(null);
    const serviceInputRef = useRef<TextInput>(null);
    const amountInputRef = useRef<TextInput>(null);
    const consumablesInputRef = useRef<TextInput>(null);
    const revealActiveField = () => {
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView
            ref={scrollRef}
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            onContentSizeChange={() => {
                if (addClientForm.showAddClient) {
                    revealActiveField();
                }
            }}
        >
            <View style={styles.header}>
                <Text style={styles.title}>{t('staff.myShift')}</Text>
                <Text style={styles.subtitle}>{formatDate(new Date(), locale)}</Text>
            </View>

            <View style={styles.contentWrap}>
                {financeData.isDayOff && !isOpen && !shift ? (
                    <View style={styles.bannerWrap}>
                        <FeedbackBanner
                            variant="warning"
                            title={t('staff.shiftQuick.dayOffTitle')}
                            message={t('staff.shiftQuick.dayOffMessage')}
                            compact
                        />
                    </View>
                ) : null}

                <Card style={styles.statusCard} variant="elevated" padding="md">
                    <View style={styles.statusTopRow}>
                        <Text style={styles.statusCardTitle}>{t('staff.shiftQuick.statusTitle')}</Text>
                        <View style={[styles.statusPill, isOpen ? styles.statusPillOpen : styles.statusPillClosed]}>
                            <Text style={[styles.statusPillText, isOpen ? styles.statusPillTextOpen : styles.statusPillTextClosed]}>
                                {t(isOpen ? 'staff.status.open' : shift ? 'staff.status.closed' : 'staff.shiftQuick.notStarted')}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.statusRow}>
                        <View
                            style={[
                                styles.statusIndicator,
                                shiftMeta.state === 'open'
                                    ? styles.statusOpen
                                    : shiftMeta.state === 'closed'
                                      ? styles.statusClosed
                                      : styles.statusIdle,
                            ]}
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                        />
                        <View style={styles.statusTextWrap} accessibilityRole="text" accessibilityLiveRegion="polite">
                            <Text style={styles.statusText}>{shiftMeta.label}</Text>
                            <Text style={styles.statusSubtext}>{shiftMeta.description}</Text>
                        </View>
                    </View>

                    <View style={styles.timelineGrid}>
                        <View style={styles.timelineItem}>
                            <Text style={styles.timelineLabel}>{t('staff.shiftQuick.openedAt')}</Text>
                            <Text style={styles.timelineValue}>{shift?.opened_at ? formatTime(shift.opened_at) : '—'}</Text>
                        </View>
                        <View style={styles.timelineItem}>
                            <Text style={styles.timelineLabel}>{t('staff.shiftQuick.worked')}</Text>
                            <Text style={styles.timelineValue}>
                                {isOpen && financeData.currentHoursWorked != null
                                    ? t('staff.hours', { hours: financeData.currentHoursWorked.toFixed(1) })
                                    : '—'}
                            </Text>
                        </View>
                    </View>

                    {pendingQueueCount > 0 && !reviewMessage ? (
                        <View style={styles.queueInlineBanner}>
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
                        </View>
                    ) : null}

                    <View style={styles.actionsRow}>
                        {!isOpen && !shift ? (
                            <Button
                                title={t('staff.shiftQuick.openShift')}
                                onPress={onOpenShift}
                                disabled={commandsBlocked || isOpening || financeData.isDayOff}
                                loading={isOpening}
                                fullWidth
                                leadingIcon={<Ionicons name="play" size={18} color="#fff" />}
                            />
                        ) : null}
                        {isOpen ? (
                            <Button
                                title={t('staff.shiftQuick.closeShift')}
                                onPress={onCloseShift}
                                disabled={commandsBlocked || isClosing || addClientForm.showAddClient}
                                loading={isClosing}
                                variant="danger"
                                fullWidth
                                leadingIcon={<Ionicons name="stop" size={18} color="#fff" />}
                            />
                        ) : null}
                    </View>
                </Card>

                {isOpen ? (
                    <View style={styles.metricsSection}>
                        <Text style={styles.sectionTitle}>{t('staff.shiftQuick.metrics')}</Text>
                        <View style={styles.statsGrid}>
                            <MetricCard
                                label={t('staff.turnover')}
                                value={money(metrics.totalAmount)}
                                icon="wallet-outline"
                            />
                            <MetricCard
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
                            <MetricCard
                                label={t('staff.shiftQuick.salon')}
                                value={money(metrics.finalSalonShare)}
                                icon="business-outline"
                            />
                            <MetricCard
                                label={t('staff.shiftQuick.clients')}
                                value={String(items.length)}
                                icon="people-outline"
                            />
                        </View>
                    </View>
                ) : null}

                {isOpen ? (
                    <Card style={styles.addClientCard} variant="elevated" padding="md">
                        <View style={styles.addClientHeader}>
                            <Text style={styles.addClientTitle}>
                                {t(isEditingClient ? 'staff.shiftQuick.editTitle' : 'staff.shiftQuick.addTitle')}
                            </Text>
                            <Text style={styles.addClientSubtitle}>{t('staff.shiftQuick.addSubtitle')}</Text>
                        </View>

                        {!addClientForm.showAddClient ? (
                            <Button
                                title={t('staff.shiftQuick.addClient')}
                                disabled={commandsBlocked}
                                onPress={() => addClientActions.setShowAddClient(true)}
                                variant="outline"
                                fullWidth
                                leadingIcon={<Ionicons name="add-circle" size={20} color={colors.accent.primary} />}
                                style={styles.addClientButton}
                                textStyle={styles.addClientButtonText}
                            />
                        ) : (
                            <View style={styles.addClientForm}>
                                {addClientForm.error ? (
                                    <FeedbackBanner
                                        variant="danger"
                                        compact
                                        title={t('staff.shiftQuick.checkForm')}
                                        message={addClientForm.error}
                                    />
                                ) : null}
                                <Input
                                    placeholder={t('staff.shiftQuick.clientNamePlaceholder')}
                                    editable={!savingBlocked && !isAddingClient}
                                    value={addClientForm.newClientName}
                                    onChangeText={addClientActions.setNewClientName}
                                    autoFocus
                                    error={addClientForm.error ?? undefined}
                                    returnKeyType="next"
                                    blurOnSubmit={false}
                                    onFocus={revealActiveField}
                                    onSubmitEditing={() => serviceInputRef.current?.focus()}
                                />
                                <Input
                                    ref={serviceInputRef}
                                    placeholder={t('staff.service')}
                                    editable={!savingBlocked && !isAddingClient}
                                    value={addClientForm.newServiceName}
                                    onChangeText={addClientActions.setNewServiceName}
                                    returnKeyType="next"
                                    blurOnSubmit={false}
                                    onFocus={revealActiveField}
                                    onSubmitEditing={() => amountInputRef.current?.focus()}
                                />
                                <View style={styles.amountRow}>
                                    <Input
                                        ref={amountInputRef}
                                        containerStyle={styles.amountInputContainer}
                                        placeholder={t('staff.shiftQuick.amountPlaceholder')}
                                        editable={!savingBlocked && !isAddingClient}
                                        value={addClientForm.newServiceAmount}
                                        onChangeText={addClientActions.setNewServiceAmount}
                                        keyboardType="numeric"
                                        returnKeyType="next"
                                        blurOnSubmit={false}
                                        onFocus={revealActiveField}
                                        onSubmitEditing={() => consumablesInputRef.current?.focus()}
                                    />
                                    <Input
                                        ref={consumablesInputRef}
                                        containerStyle={styles.amountInputContainer}
                                        placeholder={t('staff.consumables')}
                                        editable={!savingBlocked && !isAddingClient}
                                        value={addClientForm.newConsumablesAmount}
                                        onChangeText={addClientActions.setNewConsumablesAmount}
                                        keyboardType="numeric"
                                        returnKeyType="done"
                                        onFocus={revealActiveField}
                                        onSubmitEditing={() => {
                                            if (!savingBlocked && !isAddingClient && addClientForm.newClientName.trim()) {
                                                addClientActions.submit();
                                            }
                                        }}
                                    />
                                </View>
                                <View style={styles.addClientActions}>
                                    <Button
                                        title={t('staff.cancel')}
                                        onPress={addClientActions.resetForm}
                                        variant="secondary"
                                        fullWidth
                                        style={styles.addClientActionButton}
                                    />
                                    <Button
                                        title={t(isEditingClient ? 'staff.shiftQuick.saveChanges' : 'staff.shiftQuick.save')}
                                        onPress={addClientActions.submit}
                                        disabled={savingBlocked || isAddingClient || !addClientForm.newClientName.trim()}
                                        loading={isAddingClient}
                                        fullWidth
                                        style={styles.addClientActionButton}
                                    />
                                </View>
                            </View>
                        )}
                    </Card>
                ) : null}

                {items.length > 0 ? (
                    <View style={styles.clientsSection}>
                        <Text style={styles.sectionTitle}>{t('staff.shiftQuick.clientsCount', { count: items.length })}</Text>
                        {items.map((item, index) => (
                            <ClientCard
                                key={item.id || `${item.clientName}-${index}`}
                                item={item}
                                itemIndex={index}
                                canEdit={isOpen && !commandsBlocked && !deletingClient}
                                onEditClient={onEditClient}
                                onDeleteClient={onDeleteClient}
                            />
                        ))}
                    </View>
                ) : null}

                {isOpen && items.length === 0 ? (
                    <Card style={styles.emptyCard} variant="muted">
                        <EmptyState
                            compact
                            title={t('staff.shiftQuick.emptyTitle')}
                            message={t('staff.shiftQuick.emptyMessage')}
                        />
                    </Card>
                ) : null}

                {reviewMessage ? (
                    <Card padding="md">
                        <FeedbackBanner variant="warning" title={t('staff.shiftQuick.reviewTitle')} message={reviewMessage} />
                        {reviewItems ? <View>
                            <Text>{t('staff.shiftQuick.reviewDraft')}</Text>
                            {reviewItems.map((item, index) => <Text key={item.id ?? index}>
                                {t('staff.shiftQuick.reviewLine', {
                                    client: item.clientName,
                                    service: item.serviceName,
                                    amount: money(item.serviceAmount),
                                    consumables: money(item.consumablesAmount),
                                })}
                            </Text>)}
                        </View> : null}
                        <Button title={t('staff.shiftQuick.loadCurrent')} onPress={() => void onRefresh()} disabled={isProcessingQueue} />
                        {onRestoreDraft ? <Button title={t('staff.shiftQuick.restoreDraft')} onPress={onRestoreDraft} disabled={isProcessingQueue} /> : null}
                        {onDiscardDraft ? <Button title={t('staff.shiftQuick.discardDraft')} variant="secondary" onPress={onDiscardDraft} disabled={isProcessingQueue} /> : null}
                    </Card>
                ) : pendingQueueCount > 0 || isProcessingQueue ? (
                    <View style={styles.offlineIndicator}>
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
                            style={styles.offlineBanner}
                        />
                    </View>
                ) : null}
            </View>
        </ScrollView>
        </KeyboardAvoidingView>
    );
}

function MetricCard({
    label,
    value,
    hint,
    icon,
    tone = 'default',
}: {
    label: string;
    value: string;
    hint?: string;
    icon: keyof typeof Ionicons.glyphMap;
    tone?: 'default' | 'success';
}) {
    return (
        <Card style={styles.statCard} variant="muted" padding="md">
            <View style={styles.statTop}>
                <Text style={styles.statLabel}>{label}</Text>
                <Ionicons
                    name={icon}
                    size={16}
                    color={tone === 'success' ? colors.status.success : colors.text.secondary}
                />
            </View>
            <Text style={[styles.statValue, tone === 'success' ? styles.statValueEmployee : null]}>{value}</Text>
            {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
        </Card>
    );
}

function ClientCard({
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

    return (
        <Card style={styles.clientCard} variant="elevated" padding="md">
            <View style={styles.clientHeader}>
                <View style={styles.clientMain}>
                    <Text style={styles.clientName}>{item.clientName || t('staff.client')}</Text>
                    {item.serviceName ? <Text style={styles.clientService}>{item.serviceName}</Text> : null}
                </View>
                <View style={styles.clientAmountWrap}>
                    <Text style={styles.clientAmount}>{item.serviceAmount > 0 ? formatPrice(item.serviceAmount, locale) : '—'}</Text>
                    {item.consumablesAmount > 0 ? (
                        <Text style={styles.clientConsumables}>
                            {t('staff.shiftQuick.itemConsumables', { amount: formatPrice(item.consumablesAmount, locale) })}
                        </Text>
                    ) : null}
                </View>
            </View>
            <View style={styles.clientMetaRow}>
                <View style={[styles.sourceChip, item.bookingId ? styles.sourceChipBooking : styles.sourceChipManual]}>
                    <Ionicons
                        name={item.bookingId ? 'calendar-outline' : 'create-outline'}
                        size={12}
                        color={item.bookingId ? colors.status.success : colors.text.secondary}
                    />
                    <Text style={styles.sourceChipText}>{t(item.bookingId ? 'staff.shiftQuick.fromBooking' : 'staff.shiftQuick.addedManually')}</Text>
                </View>
                {item.createdAt ? <Text style={styles.clientTime}>{formatTime(item.createdAt)}</Text> : null}
            </View>
            {canEditItem ? (
                <Button
                    title={t('staff.shiftQuick.edit')}
                    onPress={() => onEditClient(item, itemIndex)}
                    variant="outline"
                    size="sm"
                    leadingIcon={<Ionicons name="create-outline" size={14} color={colors.accent.primary} />}
                    style={styles.clientEditButton}
                    textStyle={styles.clientEditButtonText}
                    accessibilityLabel={t('staff.shiftQuick.edit')}
                />
            ) : null}
            {canEditItem && item.id && onDeleteClient ? (
                <Button
                    title={t('staff.shiftQuick.delete')}
                    onPress={() => onDeleteClient(item)}
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Ionicons name="trash-outline" size={14} color={colors.status.danger} />}
                    style={styles.clientEditButton}
                    textStyle={styles.clientDeleteButtonText}
                    accessibilityLabel={t('staff.shiftQuick.deleteA11y', { client: item.clientName || t('staff.client') })}
                />
            ) : null}
        </Card>
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
