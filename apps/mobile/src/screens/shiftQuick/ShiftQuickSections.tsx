import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import OfflineBanner from '../../components/ui/OfflineBanner';
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
                <Text style={styles.title}>РњРѕСЏ СЃРјРµРЅР°</Text>
                <Text style={styles.subtitle}>{formatDate(new Date().toISOString())}</Text>
            </View>

            {financeData.isDayOff && !isOpen && !shift ? (
                <View style={styles.bannerWrap}>
                    <FeedbackBanner
                        variant="warning"
                        title="Р’С‹С…РѕРґРЅРѕР№ РґРµРЅСЊ"
                        message="РЎРµРіРѕРґРЅСЏ РѕС‚РјРµС‡РµРЅ РІС‹С…РѕРґРЅРѕР№, РїРѕСЌС‚РѕРјСѓ РѕС‚РєСЂС‹С‚РёРµ СЃРјРµРЅС‹ РЅРµРґРѕСЃС‚СѓРїРЅРѕ."
                        compact
                    />
                </View>
            ) : null}

            <Card style={styles.statusCard} variant="elevated" padding="md">
                <View style={styles.statusRow}>
                    <View style={[styles.statusIndicator, isOpen ? styles.statusOpen : styles.statusClosed]} />
                    <Text style={styles.statusText}>
                        {isOpen
                            ? 'РЎРјРµРЅР° РѕС‚РєСЂС‹С‚Р°'
                            : shift
                              ? 'РЎРјРµРЅР° Р·Р°РєСЂС‹С‚Р°'
                              : 'РЎРјРµРЅР° РЅРµ РѕС‚РєСЂС‹С‚Р°'}
                    </Text>
                </View>

                {shift?.opened_at ? <Text style={styles.statusTime}>РћС‚РєСЂС‹С‚Р°: {formatTime(shift.opened_at)}</Text> : null}
                {isOpen && financeData.currentHoursWorked ? (
                    <Text style={styles.statusTime}>РћС‚СЂР°Р±РѕС‚Р°РЅРѕ: {financeData.currentHoursWorked.toFixed(1)} С‡</Text>
                ) : null}

                <View style={styles.actionsRow}>
                    {!isOpen && !shift ? (
                        <Button
                            title="РћС‚РєСЂС‹С‚СЊ СЃРјРµРЅСѓ"
                            onPress={onOpenShift}
                            disabled={isOpening || financeData.isDayOff}
                            loading={isOpening}
                            fullWidth
                            leadingIcon={<Ionicons name="play" size={18} color="#fff" />}
                        />
                    ) : null}
                    {isOpen ? (
                        <Button
                            title="Р—Р°РєСЂС‹С‚СЊ СЃРјРµРЅСѓ"
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
                <View style={styles.statsGrid}>
                    <Card style={styles.statCard} variant="muted" padding="md">
                        <Text style={styles.statLabel}>РћР±РѕСЂРѕС‚</Text>
                        <Text style={styles.statValue}>{formatPrice(metrics.totalAmount)}</Text>
                    </Card>
                    <Card style={styles.statCard} variant="muted" padding="md">
                        <Text style={styles.statLabel}>РњРЅРµ</Text>
                        <Text style={[styles.statValue, styles.statValueEmployee]}>{formatPrice(metrics.finalMasterShare)}</Text>
                        {metrics.currentGuaranteed > metrics.baseMasterShare ? (
                            <Text style={styles.statHint}>(РіР°СЂР°РЅС‚РёСЏ: {formatPrice(metrics.currentGuaranteed)})</Text>
                        ) : null}
                    </Card>
                    <Card style={styles.statCard} variant="muted" padding="md">
                        <Text style={styles.statLabel}>РљР»РёРµРЅС‚РѕРІ</Text>
                        <Text style={styles.statValue}>{items.length}</Text>
                    </Card>
                </View>
            ) : null}

            {isOpen ? (
                <Card style={styles.addClientCard} variant="elevated" padding="md">
                    {!addClientForm.showAddClient ? (
                        <Button
                            title="Р”РѕР±Р°РІРёС‚СЊ РєР»РёРµРЅС‚Р°"
                            onPress={() => addClientActions.setShowAddClient(true)}
                            variant="outline"
                            fullWidth
                            leadingIcon={<Ionicons name="add-circle" size={20} color="#4f46e5" />}
                            style={styles.addClientButton}
                            textStyle={styles.addClientButtonText}
                        />
                    ) : (
                        <View style={styles.addClientForm}>
                            <Text style={styles.addClientFormTitle}>РќРѕРІС‹Р№ РєР»РёРµРЅС‚</Text>
                            <Input
                                placeholder="РРјСЏ РєР»РёРµРЅС‚Р° *"
                                value={addClientForm.newClientName}
                                onChangeText={addClientActions.setNewClientName}
                                autoFocus
                                error={addClientForm.error ?? undefined}
                            />
                            <Input
                                placeholder="РЈСЃР»СѓРіР°"
                                value={addClientForm.newServiceName}
                                onChangeText={addClientActions.setNewServiceName}
                            />
                            <View style={styles.amountRow}>
                                <Input
                                    containerStyle={styles.amountInputContainer}
                                    placeholder="РЎСѓРјРјР°"
                                    value={addClientForm.newServiceAmount}
                                    onChangeText={addClientActions.setNewServiceAmount}
                                    keyboardType="numeric"
                                />
                                <Input
                                    containerStyle={styles.amountInputContainer}
                                    placeholder="Р Р°СЃС…РѕРґРЅРёРєРё"
                                    value={addClientForm.newConsumablesAmount}
                                    onChangeText={addClientActions.setNewConsumablesAmount}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.addClientActions}>
                                <Button
                                    title="РћС‚РјРµРЅР°"
                                    onPress={addClientActions.resetForm}
                                    variant="secondary"
                                    fullWidth
                                    style={styles.addClientActionButton}
                                />
                                <Button
                                    title="Р”РѕР±Р°РІРёС‚СЊ"
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
                    <Text style={styles.sectionTitle}>РљР»РёРµРЅС‚С‹ ({items.length})</Text>
                    {items.map((item, index) => (
                        <ClientCard key={item.id || index} item={item} />
                    ))}
                </View>
            ) : null}

            {isOpen && items.length === 0 ? (
                <Card style={styles.emptyCard} variant="muted">
                    <EmptyState
                        compact
                        title="РќРµС‚ РґРѕР±Р°РІР»РµРЅРЅС‹С… РєР»РёРµРЅС‚РѕРІ"
                        message='РќР°Р¶РјРёС‚Рµ "Р”РѕР±Р°РІРёС‚СЊ РєР»РёРµРЅС‚Р°" РґР»СЏ РЅР°С‡Р°Р»Р° СЂР°Р±РѕС‚С‹'
                    />
                </Card>
            ) : null}

            {isProcessingQueue ? (
                <View style={styles.offlineIndicator}>
                    <OfflineBanner
                        compact
                        title="РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РѕС„Р»Р°Р№РЅ-РґР°РЅРЅС‹С…"
                        message="РћС‡РµСЂРµРґСЊ РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ, РєР°Рє С‚РѕР»СЊРєРѕ СЃРѕРµРґРёРЅРµРЅРёРµ СЃРЅРѕРІР° СЃС‚Р°Р±РёР»СЊРЅРѕ."
                        style={{ marginBottom: 0 }}
                    />
                </View>
            ) : null}
        </ScrollView>
    );
}

function ClientCard({ item }: { item: ShiftItem }) {
    return (
        <Card style={styles.clientCard} variant="elevated" padding="md">
            <View style={styles.clientHeader}>
                <Text style={styles.clientName}>{item.clientName || 'РљР»РёРµРЅС‚'}</Text>
                {item.bookingId ? (
                    <View style={styles.bookingBadge}>
                        <Ionicons name="calendar" size={12} color="#10b981" />
                    </View>
                ) : null}
            </View>
            {item.serviceName ? <Text style={styles.clientService}>{item.serviceName}</Text> : null}
            <View style={styles.clientAmounts}>
                {item.serviceAmount > 0 ? <Text style={styles.clientAmount}>{formatPrice(item.serviceAmount)}</Text> : null}
                {item.consumablesAmount > 0 ? (
                    <Text style={styles.clientConsumables}>Р Р°СЃС…РѕРґРЅРёРєРё: {formatPrice(item.consumablesAmount)}</Text>
                ) : null}
            </View>
        </Card>
    );
}
