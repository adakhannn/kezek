import { Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Card from '../../components/ui/Card';
import { formatDate, formatTime } from '../../utils/format';
import { formatPrice } from '../../utils/format';
import { styles } from './shiftQuickStyles';
import type { FinanceData, ShiftItem, ShiftQuickMetrics } from './types';

type AddClientFormState = {
    showAddClient: boolean;
    newClientName: string;
    newServiceName: string;
    newServiceAmount: string;
    newConsumablesAmount: string;
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

export function ShiftQuickSections({
    financeData,
    refreshing,
    isProcessingQueue,
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

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Моя смена</Text>
                <Text style={styles.subtitle}>{formatDate(new Date().toISOString())}</Text>
            </View>

            <Card style={styles.statusCard}>
                <View style={styles.statusRow}>
                    <View style={[styles.statusIndicator, isOpen ? styles.statusOpen : styles.statusClosed]} />
                    <Text style={styles.statusText}>
                        {isOpen ? 'Смена открыта' : shift ? 'Смена закрыта' : 'Смена не открыта'}
                    </Text>
                </View>

                {shift?.opened_at && (
                    <Text style={styles.statusTime}>Открыта: {formatTime(shift.opened_at)}</Text>
                )}

                {isOpen && financeData.currentHoursWorked && (
                    <Text style={styles.statusTime}>
                        Отработано: {financeData.currentHoursWorked.toFixed(1)} ч
                    </Text>
                )}

                <View style={styles.actionsRow}>
                    {!isOpen && !shift && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.openButton]}
                            onPress={onOpenShift}
                            disabled={isOpening || financeData.isDayOff}
                        >
                            <Ionicons name="play" size={20} color="#fff" />
                            <Text style={styles.actionButtonText}>Открыть смену</Text>
                        </TouchableOpacity>
                    )}
                    {isOpen && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.closeButton]}
                            onPress={onCloseShift}
                            disabled={isClosing}
                        >
                            <Ionicons name="stop" size={20} color="#fff" />
                            <Text style={styles.actionButtonText}>Закрыть смену</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Card>

            {isOpen && (
                <View style={styles.statsGrid}>
                    <Card style={styles.statCard}>
                        <Text style={styles.statLabel}>Оборот</Text>
                        <Text style={styles.statValue}>{formatPrice(metrics.totalAmount)}</Text>
                    </Card>
                    <Card style={styles.statCard}>
                        <Text style={styles.statLabel}>Мне</Text>
                        <Text style={[styles.statValue, styles.statValueEmployee]}>
                            {formatPrice(metrics.finalMasterShare)}
                        </Text>
                        {metrics.currentGuaranteed > metrics.baseMasterShare && (
                            <Text style={styles.statHint}>
                                (гарантия: {formatPrice(metrics.currentGuaranteed)})
                            </Text>
                        )}
                    </Card>
                    <Card style={styles.statCard}>
                        <Text style={styles.statLabel}>Клиентов</Text>
                        <Text style={styles.statValue}>{items.length}</Text>
                    </Card>
                </View>
            )}

            {isOpen && (
                <Card style={styles.addClientCard}>
                    {!addClientForm.showAddClient ? (
                        <TouchableOpacity
                            style={styles.addClientButton}
                            onPress={() => addClientActions.setShowAddClient(true)}
                        >
                            <Ionicons name="add-circle" size={24} color="#4f46e5" />
                            <Text style={styles.addClientButtonText}>Добавить клиента</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.addClientForm}>
                            <Text style={styles.addClientFormTitle}>Новый клиент</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Имя клиента *"
                                value={addClientForm.newClientName}
                                onChangeText={addClientActions.setNewClientName}
                                autoFocus
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Услуга"
                                value={addClientForm.newServiceName}
                                onChangeText={addClientActions.setNewServiceName}
                            />
                            <View style={styles.amountRow}>
                                <TextInput
                                    style={[styles.input, styles.amountInput]}
                                    placeholder="Сумма"
                                    value={addClientForm.newServiceAmount}
                                    onChangeText={addClientActions.setNewServiceAmount}
                                    keyboardType="numeric"
                                />
                                <TextInput
                                    style={[styles.input, styles.amountInput]}
                                    placeholder="Расходники"
                                    value={addClientForm.newConsumablesAmount}
                                    onChangeText={addClientActions.setNewConsumablesAmount}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.addClientActions}>
                                <TouchableOpacity
                                    style={[styles.addClientActionButton, styles.cancelButton]}
                                    onPress={addClientActions.resetForm}
                                >
                                    <Text style={styles.cancelButtonText}>Отмена</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.addClientActionButton, styles.saveButton]}
                                    onPress={addClientActions.submit}
                                    disabled={isAddingClient || !addClientForm.newClientName.trim()}
                                >
                                    <Text style={styles.saveButtonText}>Добавить</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </Card>
            )}

            {items.length > 0 && (
                <View style={styles.clientsSection}>
                    <Text style={styles.sectionTitle}>Клиенты ({items.length})</Text>
                    {items.map((item, index) => (
                        <ClientCard key={item.id || index} item={item} />
                    ))}
                </View>
            )}

            {isOpen && items.length === 0 && (
                <Card style={styles.emptyCard}>
                    <Text style={styles.emptyText}>Нет добавленных клиентов</Text>
                    <Text style={styles.emptyHint}>Нажмите "Добавить клиента" для начала работы</Text>
                </Card>
            )}

            {isProcessingQueue && (
                <View style={styles.offlineIndicator}>
                    <Text style={styles.offlineText}>Синхронизация офлайн-данных...</Text>
                </View>
            )}
        </ScrollView>
    );
}

function ClientCard({ item }: { item: ShiftItem }) {
    return (
        <Card style={styles.clientCard}>
            <View style={styles.clientHeader}>
                <Text style={styles.clientName}>{item.clientName || 'Клиент'}</Text>
                {item.bookingId && (
                    <View style={styles.bookingBadge}>
                        <Ionicons name="calendar" size={12} color="#10b981" />
                    </View>
                )}
            </View>
            {item.serviceName && <Text style={styles.clientService}>{item.serviceName}</Text>}
            <View style={styles.clientAmounts}>
                {item.serviceAmount > 0 && (
                    <Text style={styles.clientAmount}>{formatPrice(item.serviceAmount)}</Text>
                )}
                {item.consumablesAmount > 0 && (
                    <Text style={styles.clientConsumables}>
                        Расходники: {formatPrice(item.consumablesAmount)}
                    </Text>
                )}
            </View>
        </Card>
    );
}

export function confirmCloseShift(onConfirm: () => void) {
    Alert.alert('Закрыть смену?', 'После закрытия смены вы не сможете добавлять клиентов. Продолжить?', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Закрыть', style: 'destructive', onPress: onConfirm },
    ]);
}
