import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import Card from '../../components/ui/Card';
import { formatDate, formatPrice } from '../../utils/format';
import { styles } from './styles';
import type { Shift } from './types';

export function ShiftCard({ shift }: { shift: Shift }) {
    const [expanded, setExpanded] = useState(shift.status === 'open');
    const hasGuaranteed =
        shift.guaranteed_amount > 0 && !!shift.hourly_rate && shift.guaranteed_amount > shift.master_share;

    return (
        <Card style={styles.shiftCard}>
            <TouchableOpacity style={styles.shiftHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
                <View style={styles.shiftHeaderLeft}>
                    <View style={styles.shiftHeaderTop}>
                        <Text style={styles.shiftDate}>{formatDate(shift.shift_date)}</Text>
                        <View
                            style={[
                                styles.shiftStatusBadge,
                                shift.status === 'open' ? styles.shiftStatusOpen : styles.shiftStatusClosed,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.shiftStatusText,
                                    shift.status === 'open' ? styles.shiftStatusTextOpen : styles.shiftStatusTextClosed,
                                ]}
                            >
                                {shift.status === 'open' ? 'Открыта' : 'Закрыта'}
                            </Text>
                        </View>
                        {shift.items.length > 0 && (
                            <Text style={styles.shiftClientsCount}>({shift.items.length} клиентов)</Text>
                        )}
                    </View>
                    {shift.opened_at && (
                        <Text style={styles.shiftTime}>
                            Открыта:{' '}
                            {new Date(shift.opened_at).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </Text>
                    )}
                </View>

                <View style={styles.shiftHeaderRight}>
                    <Text style={styles.shiftTotalAmount}>{formatPrice(shift.total_amount)}</Text>
                    <Text style={styles.shiftConsumables}>
                        Расходники: {formatPrice(shift.consumables_amount)}
                    </Text>

                    {hasGuaranteed ? (
                        <View style={styles.shiftFinancials}>
                            <Text style={styles.shiftMasterShareGuaranteed}>
                                Сотруднику: {formatPrice(shift.guaranteed_amount)}
                            </Text>
                            {shift.hours_worked !== null && (
                                <Text style={styles.shiftHours}>За выход: {shift.hours_worked.toFixed(1)} ч</Text>
                            )}
                            <Text style={styles.shiftBaseShareStriked}>Базовая: {formatPrice(shift.master_share)}</Text>
                            <Text style={styles.shiftSalonShare}>Бизнесу: {formatPrice(shift.salon_share)}</Text>
                        </View>
                    ) : (
                        <View style={styles.shiftFinancials}>
                            <Text style={styles.shiftMasterShare}>Сотруднику: {formatPrice(shift.master_share)}</Text>
                            {shift.guaranteed_amount > 0 && shift.hourly_rate && (
                                <Text style={styles.shiftGuaranteed}>
                                    За выход: {formatPrice(shift.guaranteed_amount)}
                                    {shift.hours_worked !== null ? ` (${shift.hours_worked.toFixed(1)} ч)` : ''}
                                </Text>
                            )}
                            <Text style={styles.shiftSalonShare}>Бизнесу: {formatPrice(shift.salon_share)}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>

            {expanded && shift.items.length > 0 && (
                <View style={styles.shiftItems}>
                    <Text style={styles.shiftItemsTitle}>Список клиентов</Text>
                    {shift.items.map((item) => (
                        <View key={item.id} style={styles.shiftItem}>
                            <View style={styles.shiftItemLeft}>
                                {item.booking_id && <View style={styles.bookingIndicator} />}
                                <View style={styles.shiftItemInfo}>
                                    <Text style={styles.shiftItemClient}>{item.client_name || 'Клиент не указан'}</Text>
                                    <Text style={styles.shiftItemService}>{item.service_name || '—'}</Text>
                                </View>
                            </View>
                            <View style={styles.shiftItemRight}>
                                <Text style={styles.shiftItemAmount}>{formatPrice(item.service_amount)}</Text>
                                {item.consumables_amount > 0 && (
                                    <Text style={styles.shiftItemConsumables}>
                                        Расходники: {formatPrice(item.consumables_amount)}
                                    </Text>
                                )}
                                {item.created_at && (
                                    <Text style={styles.shiftItemTime}>
                                        {new Date(item.created_at).toLocaleTimeString('ru-RU', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </Text>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {expanded && shift.items.length === 0 && (
                <View style={styles.shiftItemsEmpty}>
                    <Text style={styles.shiftItemsEmptyText}>Нет добавленных клиентов</Text>
                </View>
            )}
        </Card>
    );
}
