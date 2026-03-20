import { Text, TouchableOpacity, View } from 'react-native';

import { styles } from './styles';

export function StaffActionButtons({
    onShiftQuick,
    onShiftsStats,
}: {
    onShiftQuick: () => void;
    onShiftsStats: () => void;
}) {
    return (
        <View style={styles.section}>
            <TouchableOpacity style={styles.shiftsButton} onPress={onShiftQuick}>
                <Text style={styles.shiftsButtonText}>Моя смена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.shiftsButton, styles.shiftsButtonSecondary]} onPress={onShiftsStats}>
                <Text style={styles.shiftsButtonTextSecondary}>Статистика</Text>
            </TouchableOpacity>
        </View>
    );
}
