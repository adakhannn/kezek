import { Text, TouchableOpacity, View } from 'react-native';

import { styles } from './styles';

type Props = {
    period: 'day' | 'month' | 'year';
    setPeriod: (period: 'day' | 'month' | 'year') => void;
};

export function ShiftsPeriodFilter({ period, setPeriod }: Props) {
    return (
        <View style={styles.filters}>
            <View style={styles.periodButtons}>
                <TouchableOpacity
                    style={[styles.periodButton, period === 'day' && styles.periodButtonActive]}
                    onPress={() => setPeriod('day')}
                >
                    <Text style={[styles.periodButtonText, period === 'day' && styles.periodButtonTextActive]}>
                        День
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
                    onPress={() => setPeriod('month')}
                >
                    <Text style={[styles.periodButtonText, period === 'month' && styles.periodButtonTextActive]}>
                        Месяц
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.periodButton, period === 'year' && styles.periodButtonActive]}
                    onPress={() => setPeriod('year')}
                >
                    <Text style={[styles.periodButtonText, period === 'year' && styles.periodButtonTextActive]}>
                        Год
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
