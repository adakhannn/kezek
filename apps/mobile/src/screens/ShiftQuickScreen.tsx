import { View, Text, ScrollView, RefreshControl, Alert } from 'react-native';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/format';
import { getShiftCompensation, getShiftTotals } from './shiftQuick/calculations';
import { ShiftQuickAddClientCard } from './shiftQuick/ShiftQuickAddClientCard';
import { ShiftQuickClientsSection } from './shiftQuick/ShiftQuickClientsSection';
import { ShiftQuickOfflineIndicator } from './shiftQuick/ShiftQuickOfflineIndicator';
import { ShiftQuickScreenState } from './shiftQuick/ShiftQuickScreenState';
import { ShiftQuickStatsGrid } from './shiftQuick/ShiftQuickStatsGrid';
import { ShiftQuickStatusCard } from './shiftQuick/ShiftQuickStatusCard';
import { styles } from './shiftQuick/styles';
import { useShiftQuickAddClientForm } from './shiftQuick/useShiftQuickAddClientForm';
import { useShiftQuickData } from './shiftQuick/useShiftQuickData';
import { useShiftQuickOperations } from './shiftQuick/useShiftQuickOperations';

export default function ShiftQuickScreen() {
    const [refreshing, setRefreshing] = useState(false);

    const { user } = useAuth();
    const addClientForm = useShiftQuickAddClientForm();

    const { staffInfo, financeData, financeDataQuery } = useShiftQuickData({
        userId: user?.id,
    });

    const {
        isProcessingQueue,
        openShiftMutation,
        closeShiftMutation,
        addClientMutation,
        handleOpenShift,
        handleCloseShift,
        onRefresh: refreshShiftData,
    } = useShiftQuickOperations({
        financeData,
        refetch: financeDataQuery.refetch,
    });

    const handleAddClient = () => {
        const draft = addClientForm.buildDraft();
        if (!draft.clientName) {
            Alert.alert('Ошибка', 'Введите имя клиента');
            return;
        }

        addClientMutation.mutate(draft, {
            onSuccess: () => {
                addClientForm.resetForm();
            },
        });
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshShiftData();
        setRefreshing(false);
    };

    if (financeDataQuery.isLoading && !financeData) {
        return <ShiftQuickScreenState mode="loading" />;
    }

    if (!staffInfo) {
        return <ShiftQuickScreenState mode="not-staff" />;
    }

    if (financeDataQuery.error && !financeData) {
        return <ShiftQuickScreenState mode="error" />;
    }

    const shift = financeData?.today.shift ?? null;
    const items = financeData?.today.items || [];
    const isOpen = shift?.status === 'open';
    const { totalAmount } = getShiftTotals(items);
    const { baseMasterShare, currentGuaranteed, finalMasterShare } = getShiftCompensation(items, financeData);

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Моя смена</Text>
                <Text style={styles.subtitle}>{formatDate(new Date().toISOString())}</Text>
            </View>

            <ShiftQuickStatusCard
                shift={shift}
                isOpen={isOpen}
                financeData={financeData}
                openDisabled={openShiftMutation.isPending || !!financeData?.isDayOff}
                closeDisabled={closeShiftMutation.isPending}
                onOpenShift={handleOpenShift}
                onCloseShift={handleCloseShift}
            />

            {isOpen && (
                <ShiftQuickStatsGrid
                    totalAmount={totalAmount}
                    finalMasterShare={finalMasterShare}
                    currentGuaranteed={currentGuaranteed}
                    baseMasterShare={baseMasterShare}
                    itemsCount={items.length}
                />
            )}

            {isOpen && (
                <ShiftQuickAddClientCard
                    form={addClientForm}
                    isSaving={addClientMutation.isPending}
                    onSave={handleAddClient}
                />
            )}

            <ShiftQuickClientsSection items={items} isOpen={isOpen} />

            <ShiftQuickOfflineIndicator visible={isProcessingQueue} />
        </ScrollView>
    );
}

