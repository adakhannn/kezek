import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { colors } from '../../constants/colors';
import { formatDate, formatPrice, formatTime } from '../../utils/format';
import { styles } from './shiftQuickStyles';
import type { FinanceData, ShiftItem, ShiftQuickMetrics } from './types';

type AddClientFormState = {
    showAddClient: boolean;
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
    isOpening: boolean;
    isClosing: boolean;
    isAddingClient: boolean;
    metrics: ShiftQuickMetrics;
    addClientForm: AddClientFormState;
    addClientActions: AddClientFormActions;
    onRefresh: () => Promise<void>;
    onOpenShift: () => void;
    onCloseShift: () => void;
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
    isOpening,
    isClosing,
    isAddingClient,
    metrics,
    addClientForm,
    addClientActions,
    onRefresh,
    onOpenShift,
    onCloseShift,
}: ShiftQuickSectionsProps) {
    const shift = financeData.today.shift;
    const items = financeData.today.items || [];
    const isOpen = shift?.status === 'open';
    const shiftMeta = getShiftStatusMeta(isOpen, !!shift);

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Моя смена</Text>
                <Text style={styles.subtitle}>{formatDate(new Date().toISOString())}</Text>
            </View>

            <View style={styles.contentWrap}>
                {financeData.isDayOff && !isOpen && !shift ? (
                    <View style={styles.bannerWrap}>
                        <FeedbackBanner
                            variant="warning"
                            title="Выходной день"
                            message="Сегодня отмечен выходной, поэтому открыть смену не получится."
                            compact
                        />
                    </View>
                ) : null}

                <Card style={styles.statusCard} variant="elevated" padding="md">
                    <View style={styles.statusTopRow}>
                        <Text style={styles.statusCardTitle}>?????? ?????</Text>
                        <View style={[styles.statusPill, isOpen ? styles.statusPillOpen : styles.statusPillClosed]}>
                            <Text style={[styles.statusPillText, isOpen ? styles.statusPillTextOpen : styles.statusPillTextClosed]}>
                                {isOpen ? 'Открыта' : shift ? 'Закрыта' : 'Не начата'}
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
                            <Text style={styles.timelineLabel}>Открыта</Text>
                            <Text style={styles.timelineValue}>{shift?.opened_at ? formatTime(shift.opened_at) : '?'}</Text>
                        </View>
                        <View style={styles.timelineItem}>
                            <Text style={styles.timelineLabel}>Отработано</Text>
                            <Text style={styles.timelineValue}>
                                {isOpen && financeData.currentHoursWorked != null
                                    ? `${financeData.currentHoursWorked.toFixed(1)} ?`
                                    : '—'}
                            </Text>
                        </View>
                    </View>

                    {pendingQueueCount > 0 ? (
                        <View style={styles.queueInlineBanner}>
                            <FeedbackBanner
                                variant="info"
                                compact
                                title={
                                    isProcessingQueue
                                        ? 'Синхронизируем офлайн-операции'
                                        : `${pendingQueueCount} ???????? ? ???????`
                                }
                                message={
                                    isProcessingQueue
                                        ? 'Пожалуйста, подождите. Данные скоро обновятся автоматически.'
                                        : 'Действия сохранены локально и отправятся при стабильном интернете.'
                                }
                            />
                        </View>
                    ) : null}

                    <View style={styles.actionsRow}>
                        {!isOpen && !shift ? (
                            <Button
                                title="Открыть смену"
                                onPress={onOpenShift}
                                disabled={isOpening || financeData.isDayOff}
                                loading={isOpening}
                                fullWidth
                                leadingIcon={<Ionicons name="play" size={18} color="#fff" />}
                            />
                        ) : null}
                        {isOpen ? (
                            <Button
                                title="Закрыть смену"
                                onPress={onCloseShift}
                                disabled={isClosing}
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
                        <Text style={styles.sectionTitle}>Показатели смены</Text>
                        <View style={styles.statsGrid}>
                            <MetricCard
                                label="Оборот"
                                value={formatPrice(metrics.totalAmount)}
                                icon="wallet-outline"
                            />
                            <MetricCard
                                label="Мастер"
                                value={formatPrice(metrics.finalMasterShare)}
                                hint={
                                    metrics.currentGuaranteed > metrics.baseMasterShare
                                        ? `????????: ${formatPrice(metrics.currentGuaranteed)}`
                                        : undefined
                                }
                                icon="trending-up-outline"
                                tone="success"
                            />
                            <MetricCard
                                label="Салон"
                                value={formatPrice(metrics.finalSalonShare)}
                                icon="business-outline"
                            />
                            <MetricCard
                                label="Клиенты"
                                value={String(items.length)}
                                icon="people-outline"
                            />
                        </View>
                    </View>
                ) : null}

                {isOpen ? (
                    <Card style={styles.addClientCard} variant="elevated" padding="md">
                        <View style={styles.addClientHeader}>
                            <Text style={styles.addClientTitle}>?????????? ???????</Text>
                            <Text style={styles.addClientSubtitle}>?????? ???????????? ?????? ? ????? ??? ?????? ?????.</Text>
                        </View>

                        {!addClientForm.showAddClient ? (
                            <Button
                                title="Добавить клиента"
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
                                        title="Проверьте форму"
                                        message={addClientForm.error}
                                    />
                                ) : null}
                                <Input
                                    placeholder="Имя клиента *"
                                    value={addClientForm.newClientName}
                                    onChangeText={addClientActions.setNewClientName}
                                    autoFocus
                                    error={addClientForm.error ?? undefined}
                                />
                                <Input
                                    placeholder="Услуга"
                                    value={addClientForm.newServiceName}
                                    onChangeText={addClientActions.setNewServiceName}
                                />
                                <View style={styles.amountRow}>
                                    <Input
                                        containerStyle={styles.amountInputContainer}
                                        placeholder="Сумма"
                                        value={addClientForm.newServiceAmount}
                                        onChangeText={addClientActions.setNewServiceAmount}
                                        keyboardType="numeric"
                                    />
                                    <Input
                                        containerStyle={styles.amountInputContainer}
                                        placeholder="Расходники"
                                        value={addClientForm.newConsumablesAmount}
                                        onChangeText={addClientActions.setNewConsumablesAmount}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={styles.addClientActions}>
                                    <Button
                                        title="Отмена"
                                        onPress={addClientActions.resetForm}
                                        variant="secondary"
                                        fullWidth
                                        style={styles.addClientActionButton}
                                    />
                                    <Button
                                        title="Сохранить"
                                        onPress={addClientActions.submit}
                                        disabled={isAddingClient || !addClientForm.newClientName.trim()}
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
                        <Text style={styles.sectionTitle}>Клиенты ({items.length})</Text>
                        {items.map((item, index) => (
                            <ClientCard key={item.id || `${item.clientName}-${index}`} item={item} />
                        ))}
                    </View>
                ) : null}

                {isOpen && items.length === 0 ? (
                    <Card style={styles.emptyCard} variant="muted">
                        <EmptyState
                            compact
                            title="Пока нет клиентов в смене"
                            message='Нажмите "Добавить клиента", чтобы зафиксировать первую запись.'
                        />
                    </Card>
                ) : null}

                {pendingQueueCount > 0 || isProcessingQueue ? (
                    <View style={styles.offlineIndicator}>
                        <OfflineBanner
                            compact
                            title={
                                isProcessingQueue
                                    ? 'Синхронизация офлайн-очереди'
                                    : `??????-???????: ${pendingQueueCount}`
                            }
                            message={
                                isProcessingQueue
                                    ? 'Ожидайте завершения синхронизации, затем список обновится автоматически.'
                                    : 'Действия будут отправлены на сервер, как только соединение станет стабильным.'
                            }
                            onRetry={() => void onRefresh()}
                            style={styles.offlineBanner}
                        />
                    </View>
                ) : null}
            </View>
        </ScrollView>
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

function ClientCard({ item }: { item: ShiftItem }) {
    return (
        <Card style={styles.clientCard} variant="elevated" padding="md">
            <View style={styles.clientHeader}>
                <View style={styles.clientMain}>
                    <Text style={styles.clientName}>{item.clientName || 'Клиент'}</Text>
                    {item.serviceName ? <Text style={styles.clientService}>{item.serviceName}</Text> : null}
                </View>
                <View style={styles.clientAmountWrap}>
                    <Text style={styles.clientAmount}>{item.serviceAmount > 0 ? formatPrice(item.serviceAmount) : '?'}</Text>
                    {item.consumablesAmount > 0 ? (
                        <Text style={styles.clientConsumables}>?????????? {formatPrice(item.consumablesAmount)}</Text>
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
                    <Text style={styles.sourceChipText}>{item.bookingId ? '?? ?????' : '???????? ???????'}</Text>
                </View>
                {item.createdAt ? <Text style={styles.clientTime}>{formatTime(item.createdAt)}</Text> : null}
            </View>
        </Card>
    );
}

function getShiftStatusMeta(isOpen: boolean, hasShift: boolean): ShiftStatusMeta {
    if (isOpen) {
        return {
            label: 'Смена активна',
            description: 'Можно добавлять клиентов и оперативно контролировать показатели.',
            state: 'open',
        };
    }

    if (hasShift) {
        return {
            label: 'Смена закрыта',
            description: 'Рабочий день завершен. Данные доступны для просмотра.',
            state: 'closed',
        };
    }

    return {
        label: 'Смена не открыта',
        description: 'Откройте смену, чтобы начать работу с клиентами.',
        state: 'idle',
    };
}
