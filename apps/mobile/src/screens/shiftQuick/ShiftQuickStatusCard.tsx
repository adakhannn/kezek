import { Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import Card from '../../components/ui/Card';
import { formatTime } from '../../utils/format';
import type { FinanceData, TodayShift } from './types';
import { styles } from './styles';

type Props = {
    shift: TodayShift['shift'];
    isOpen: boolean;
    financeData?: FinanceData | null;
    openDisabled: boolean;
    closeDisabled: boolean;
    onOpenShift: () => void;
    onCloseShift: () => void;
};

export function ShiftQuickStatusCard({
    shift,
    isOpen,
    financeData,
    openDisabled,
    closeDisabled,
    onOpenShift,
    onCloseShift,
}: Props) {
    return (
        <Card style={styles.statusCard}>
            <View style={styles.statusRow}>
                <View style={[styles.statusIndicator, isOpen ? styles.statusOpen : styles.statusClosed]} />
                <Text style={styles.statusText}>
                    {isOpen ? 'Смена открыта' : shift ? 'Смена закрыта' : 'Смена не открыта'}
                </Text>
            </View>
            {shift?.opened_at && (
                <Text style={styles.statusTime}>
                    Открыта: {formatTime(shift.opened_at)}
                </Text>
            )}
            {isOpen && financeData?.currentHoursWorked && (
                <Text style={styles.statusTime}>
                    Отработано: {financeData.currentHoursWorked.toFixed(1)} ч
                </Text>
            )}

            <View style={styles.actionsRow}>
                {!isOpen && !shift && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.openButton]}
                        onPress={onOpenShift}
                        disabled={openDisabled}
                    >
                        <Ionicons name="play" size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>Открыть смену</Text>
                    </TouchableOpacity>
                )}
                {isOpen && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.closeButton]}
                        onPress={onCloseShift}
                        disabled={closeDisabled}
                    >
                        <Ionicons name="stop" size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>Закрыть смену</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Card>
    );
}
