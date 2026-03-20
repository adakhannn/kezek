import { Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import Card from '../../components/ui/Card';
import { formatPrice } from '../../utils/format';
import { styles } from './styles';
import type { ShiftItem } from './types';

type Props = {
    items: ShiftItem[];
    isOpen: boolean;
};

export function ShiftQuickClientsSection({ items, isOpen }: Props) {
    if (items.length > 0) {
        return (
            <View style={styles.clientsSection}>
                <Text style={styles.sectionTitle}>Клиенты ({items.length})</Text>
                {items.map((item, index) => (
                    <Card key={item.id || index} style={styles.clientCard}>
                        <View style={styles.clientHeader}>
                            <Text style={styles.clientName}>{item.clientName || 'Клиент'}</Text>
                            {item.bookingId && (
                                <View style={styles.bookingBadge}>
                                    <Ionicons name="calendar" size={12} color="#10b981" />
                                </View>
                            )}
                        </View>
                        {item.serviceName && (
                            <Text style={styles.clientService}>{item.serviceName}</Text>
                        )}
                        <View style={styles.clientAmounts}>
                            {item.serviceAmount > 0 && (
                                <Text style={styles.clientAmount}>
                                    {formatPrice(item.serviceAmount)}
                                </Text>
                            )}
                            {item.consumablesAmount > 0 && (
                                <Text style={styles.clientConsumables}>
                                    Расходники: {formatPrice(item.consumablesAmount)}
                                </Text>
                            )}
                        </View>
                    </Card>
                ))}
            </View>
        );
    }

    if (isOpen) {
        return (
            <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>Нет добавленных клиентов</Text>
                <Text style={styles.emptyHint}>Нажмите "Добавить клиента" для начала работы</Text>
            </Card>
        );
    }

    return null;
}
