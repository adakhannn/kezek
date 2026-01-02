import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatInTimeZone } from 'date-fns-tz';
import { addDays, addMinutes } from 'date-fns';

import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

type BookingRouteParams = {
    slug: string;
};

type BookingScreenRouteProp = RouteProp<{ params: BookingRouteParams }, 'params'>;
type BookingScreenNavigationProp = NativeStackNavigationProp<any>;

type Business = {
    id: string;
    name: string;
    slug: string;
};

type Branch = {
    id: string;
    name: string;
};

type Service = {
    id: string;
    name_ru: string;
    duration_min: number;
    price_from: number | null;
    price_to: number | null;
    branch_id: string;
};

type Staff = {
    id: string;
    full_name: string;
    branch_id: string;
};

type Slot = {
    staff_id: string;
    branch_id: string;
    start_at: string;
    end_at: string;
};

const TZ = 'Asia/Bishkek';

export default function BookingScreen() {
    const route = useRoute<BookingScreenRouteProp>();
    const navigation = useNavigation<BookingScreenNavigationProp>();
    const { slug } = route.params || {};

    const [branchId, setBranchId] = useState<string>('');
    const [serviceId, setServiceId] = useState<string>('');
    const [staffId, setStaffId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date();
        return formatInTimeZone(today, TZ, 'yyyy-MM-dd');
    });
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

    // Загрузка данных бизнеса
    const { data: businessData, isLoading: businessLoading } = useQuery({
        queryKey: ['business', slug],
        queryFn: async () => {
            const { data: biz, error } = await supabase
                .from('businesses')
                .select('id, name, slug')
                .eq('slug', slug)
                .eq('is_approved', true)
                .single();

            if (error) throw error;
            if (!biz) throw new Error('Бизнес не найден');

            const [branches, services, staff] = await Promise.all([
                supabase
                    .from('branches')
                    .select('id, name')
                    .eq('biz_id', biz.id)
                    .eq('is_active', true)
                    .order('name'),
                supabase
                    .from('services')
                    .select('id, name_ru, duration_min, price_from, price_to, branch_id')
                    .eq('biz_id', biz.id)
                    .eq('active', true)
                    .order('name_ru'),
                supabase
                    .from('staff')
                    .select('id, full_name, branch_id')
                    .eq('biz_id', biz.id)
                    .eq('is_active', true)
                    .order('full_name'),
            ]);

            return {
                business: biz as Business,
                branches: (branches.data || []) as Branch[],
                services: (services.data || []) as Service[],
                staff: (staff.data || []) as Staff[],
            };
        },
        enabled: !!slug,
    });

    // Инициализация выбранных значений
    useEffect(() => {
        if (businessData) {
            const firstBranch = businessData.branches[0]?.id || '';
            setBranchId(firstBranch);
        }
    }, [businessData]);

    // Фильтрация услуг и мастеров по филиалу
    const servicesByBranch = useMemo(() => {
        if (!businessData || !branchId) return [];
        return businessData.services.filter((s) => s.branch_id === branchId);
    }, [businessData, branchId]);

    const staffByBranch = useMemo(() => {
        if (!businessData || !branchId) return [];
        return businessData.staff.filter((s) => s.branch_id === branchId);
    }, [businessData, branchId]);

    // Обновление выбранных значений при смене филиала
    useEffect(() => {
        if (servicesByBranch.length > 0) {
            setServiceId(servicesByBranch[0].id);
        }
        if (staffByBranch.length > 0) {
            setStaffId(staffByBranch[0].id);
        }
    }, [branchId]);

    // Загрузка слотов
    const { data: slots, isLoading: slotsLoading } = useQuery({
        queryKey: ['slots', businessData?.business.id, serviceId, selectedDate],
        queryFn: async () => {
            if (!businessData || !serviceId || !selectedDate) return [];

            const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
                p_biz_id: businessData.business.id,
                p_service_id: serviceId,
                p_day: selectedDate,
                p_per_staff: 400,
                p_step_min: 15,
            });

            if (error) throw error;

            const all = (data || []) as Slot[];
            const now = new Date();
            const minTime = addMinutes(now, 30);

            // Фильтруем по выбранному мастеру, филиалу и времени
            const filtered = all.filter(
                (s) =>
                    s.staff_id === staffId &&
                    s.branch_id === branchId &&
                    new Date(s.start_at) > minTime
            );

            return filtered;
        },
        enabled: !!businessData && !!serviceId && !!staffId && !!branchId && !!selectedDate,
    });

    // Создание бронирования
    const createBookingMutation = useMutation({
        mutationFn: async (slot: Slot) => {
            if (!businessData) throw new Error('Данные бизнеса не загружены');

            return apiRequest<{ ok: boolean; booking_id: string }>('/quick-hold', {
                method: 'POST',
                body: JSON.stringify({
                    biz_id: businessData.business.id,
                    service_id: serviceId,
                    staff_id: staffId,
                    start_at: slot.start_at,
                }),
            });
        },
        onSuccess: (data) => {
            Alert.alert('Успешно', 'Запись создана!', [
                {
                    text: 'OK',
                    onPress: () => {
                        // @ts-ignore
                        navigation.navigate('BookingDetails', { id: data.booking_id });
                    },
                },
            ]);
        },
        onError: (error: Error) => {
            Alert.alert('Ошибка', error.message || 'Не удалось создать запись');
        },
    });

    const handleCreateBooking = () => {
        if (!selectedSlot) {
            Alert.alert('Ошибка', 'Выберите время');
            return;
        }

        Alert.alert('Подтверждение', 'Создать запись?', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Создать',
                onPress: () => createBookingMutation.mutate(selectedSlot),
            },
        ]);
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return formatInTimeZone(date, TZ, 'HH:mm');
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString + 'T00:00:00');
        // Используем простой формат без локализации
        const day = date.getDate();
        const month = date.toLocaleDateString('ru-RU', { month: 'long' });
        return `${day} ${month}`;
    };

    const getAvailableDates = () => {
        const dates: string[] = [];
        const today = new Date();
        for (let i = 0; i < 30; i++) {
            const date = addDays(today, i);
            dates.push(formatInTimeZone(date, TZ, 'yyyy-MM-dd'));
        }
        return dates;
    };

    if (businessLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
        );
    }

    if (!businessData) {
        return (
            <View style={styles.container}>
                <Text style={styles.error}>Бизнес не найден</Text>
            </View>
        );
    }

    const selectedService = servicesByBranch.find((s) => s.id === serviceId);
    const selectedStaff = staffByBranch.find((s) => s.id === staffId);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{businessData.business.name}</Text>
            </View>

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Филиал</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                    {businessData.branches.map((branch) => (
                        <TouchableOpacity
                            key={branch.id}
                            style={[styles.option, branchId === branch.id && styles.optionSelected]}
                            onPress={() => setBranchId(branch.id)}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    branchId === branch.id && styles.optionTextSelected,
                                ]}
                            >
                                {branch.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </Card>

            {servicesByBranch.length > 0 && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Услуга</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {servicesByBranch.map((service) => (
                            <TouchableOpacity
                                key={service.id}
                                style={[styles.option, serviceId === service.id && styles.optionSelected]}
                                onPress={() => setServiceId(service.id)}
                            >
                                <Text
                                    style={[
                                        styles.optionText,
                                        serviceId === service.id && styles.optionTextSelected,
                                    ]}
                                >
                                    {service.name_ru}
                                </Text>
                                {service.price_from && (
                                    <Text style={styles.priceText}>
                                        {service.price_from}
                                        {service.price_to && `-${service.price_to}`} сом
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </Card>
            )}

            {staffByBranch.length > 0 && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Мастер</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {staffByBranch.map((staff) => (
                            <TouchableOpacity
                                key={staff.id}
                                style={[styles.option, staffId === staff.id && styles.optionSelected]}
                                onPress={() => setStaffId(staff.id)}
                            >
                                <Text
                                    style={[
                                        styles.optionText,
                                        staffId === staff.id && styles.optionTextSelected,
                                    ]}
                                >
                                    {staff.full_name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </Card>
            )}

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Дата</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                    {getAvailableDates().map((date) => (
                        <TouchableOpacity
                            key={date}
                            style={[styles.dateOption, selectedDate === date && styles.dateOptionSelected]}
                            onPress={() => {
                                setSelectedDate(date);
                                setSelectedSlot(null);
                            }}
                        >
                            <Text
                                style={[
                                    styles.dateText,
                                    selectedDate === date && styles.dateTextSelected,
                                ]}
                            >
                                {formatDate(date)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </Card>

            {serviceId && staffId && branchId && selectedDate && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Время</Text>
                    {slotsLoading ? (
                        <ActivityIndicator size="small" color="#6366f1" style={styles.slotsLoading} />
                    ) : slots && slots.length > 0 ? (
                        <View style={styles.slotsGrid}>
                            {slots.map((slot, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.slotButton,
                                        selectedSlot?.start_at === slot.start_at && styles.slotButtonSelected,
                                    ]}
                                    onPress={() => setSelectedSlot(slot)}
                                >
                                    <Text
                                        style={[
                                            styles.slotText,
                                            selectedSlot?.start_at === slot.start_at && styles.slotTextSelected,
                                        ]}
                                    >
                                        {formatTime(slot.start_at)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.noSlots}>Нет доступного времени</Text>
                    )}
                </Card>
            )}

            {selectedSlot && (
                <View style={styles.summary}>
                    <Card style={styles.card}>
                        <Text style={styles.summaryTitle}>Итого</Text>
                        {selectedService && (
                            <Text style={styles.summaryText}>Услуга: {selectedService.name_ru}</Text>
                        )}
                        {selectedStaff && (
                            <Text style={styles.summaryText}>Мастер: {selectedStaff.full_name}</Text>
                        )}
                        <Text style={styles.summaryText}>
                            Дата: {formatDate(selectedDate)} в {formatTime(selectedSlot.start_at)}
                        </Text>
                        {selectedService?.duration_min && (
                            <Text style={styles.summaryText}>
                                Продолжительность: {selectedService.duration_min} мин.
                            </Text>
                        )}
                    </Card>

                    <Button
                        title="Записаться"
                        onPress={handleCreateBooking}
                        loading={createBookingMutation.isPending}
                        disabled={createBookingMutation.isPending}
                        style={styles.createButton}
                    />
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    loadingText: {
        marginTop: 12,
        textAlign: 'center',
        color: '#6b7280',
    },
    error: {
        textAlign: 'center',
        padding: 40,
        color: '#ef4444',
        fontSize: 16,
    },
    card: {
        margin: 20,
        marginBottom: 0,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    horizontalScroll: {
        marginHorizontal: -4,
    },
    option: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        marginRight: 8,
        marginBottom: 8,
    },
    optionSelected: {
        backgroundColor: '#6366f1',
    },
    optionText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    optionTextSelected: {
        color: '#fff',
    },
    priceText: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    dateOption: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        marginRight: 8,
        alignItems: 'center',
    },
    dateOptionSelected: {
        backgroundColor: '#6366f1',
    },
    dateText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    dateTextSelected: {
        color: '#fff',
    },
    slotsLoading: {
        padding: 20,
    },
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    slotButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        minWidth: 80,
        alignItems: 'center',
    },
    slotButtonSelected: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    slotText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    slotTextSelected: {
        color: '#fff',
    },
    noSlots: {
        textAlign: 'center',
        padding: 20,
        color: '#6b7280',
    },
    summary: {
        padding: 20,
    },
    summaryTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12,
    },
    summaryText: {
        fontSize: 16,
        color: '#374151',
        marginBottom: 8,
    },
    createButton: {
        marginTop: 16,
    },
});

