import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatInTimeZone } from 'date-fns-tz';
import { addDays, addMinutes } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { formatDate, formatTime } from '../utils/format';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

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
    const { showToast } = useToast();
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
        if (servicesByBranch.length > 0 && !serviceId) {
            setServiceId(servicesByBranch[0].id);
        }
        if (staffByBranch.length > 0 && !staffId) {
            setStaffId(staffByBranch[0].id);
        }
    }, [branchId]);

    // Загрузка слотов
    const { data: slots, isLoading: slotsLoading } = useQuery({
        queryKey: ['slots', businessData?.business.id, serviceId, selectedDate, staffId, branchId],
        queryFn: async () => {
            if (!businessData || !serviceId || !selectedDate || !staffId || !branchId) return [];

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
            showToast('Запись создана!', 'success');
            setTimeout(() => {
                // @ts-ignore
                navigation.navigate('BookingDetails', { id: data.booking_id });
            }, 500);
        },
        onError: (error: Error) => {
            showToast(error.message || 'Не удалось создать запись', 'error');
        },
    });

    const handleCreateBooking = () => {
        if (!selectedSlot) {
            showToast('Выберите время', 'error');
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

    const formatTimeSlot = (dateString: string) => {
        const date = new Date(dateString);
        return formatInTimeZone(date, TZ, 'HH:mm');
    };

    const formatDateLabel = (dateString: string) => {
        const date = new Date(dateString + 'T00:00:00');
        const day = date.getDate();
        const month = date.toLocaleDateString('ru-RU', { month: 'long' });
        const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' });
        return { day, month, weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1) };
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

    const formatPrice = (service: Service) => {
        if (service.price_from && service.price_to) {
            return `${service.price_from} - ${service.price_to} сом`;
        } else if (service.price_from) {
            return `от ${service.price_from} сом`;
        }
        return null;
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

    // Определяем прогресс заполнения формы
    const step = !branchId ? 1 : !serviceId ? 2 : !staffId ? 3 : !selectedDate ? 4 : !selectedSlot ? 5 : 6;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Заголовок */}
            <View style={styles.header}>
                <Text style={styles.title}>{businessData.business.name}</Text>
                <Text style={styles.subtitle}>Запись на услугу</Text>
            </View>

            {/* Шаг 1: Филиал */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.stepIndicator, step >= 1 && styles.stepIndicatorActive]}>
                        <Text style={[styles.stepNumber, step >= 1 && styles.stepNumberActive]}>1</Text>
                    </View>
                    <Text style={styles.sectionTitle}>Выберите филиал</Text>
                </View>
                {businessData.branches.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {businessData.branches.map((branch) => (
                            <TouchableOpacity
                                key={branch.id}
                                style={[styles.optionCard, branchId === branch.id && styles.optionCardSelected]}
                                onPress={() => {
                                    setBranchId(branch.id);
                                    setServiceId('');
                                    setStaffId('');
                                    setSelectedSlot(null);
                                }}
                            >
                                <Ionicons 
                                    name="location" 
                                    size={20} 
                                    color={branchId === branch.id ? '#6366f1' : '#6b7280'} 
                                />
                                <Text
                                    style={[
                                        styles.optionCardText,
                                        branchId === branch.id && styles.optionCardTextSelected,
                                    ]}
                                >
                                    {branch.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                ) : (
                    <Text style={styles.emptyText}>Нет доступных филиалов</Text>
                )}
            </View>

            {/* Шаг 2: Услуга */}
            {branchId && servicesByBranch.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.stepIndicator, step >= 2 && styles.stepIndicatorActive]}>
                            <Text style={[styles.stepNumber, step >= 2 && styles.stepNumberActive]}>2</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Выберите услугу</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {servicesByBranch.map((service) => (
                            <TouchableOpacity
                                key={service.id}
                                style={[styles.serviceCard, serviceId === service.id && styles.serviceCardSelected]}
                                onPress={() => {
                                    setServiceId(service.id);
                                    setSelectedSlot(null);
                                }}
                            >
                                <Text
                                    style={[
                                        styles.serviceName,
                                        serviceId === service.id && styles.serviceNameSelected,
                                    ]}
                                >
                                    {service.name_ru}
                                </Text>
                                {service.duration_min && (
                                    <View style={styles.serviceMeta}>
                                        <Ionicons name="time-outline" size={14} color={serviceId === service.id ? '#fff' : '#6b7280'} />
                                        <Text style={[styles.serviceDuration, serviceId === service.id && styles.serviceDurationSelected]}>
                                            {service.duration_min} мин.
                                        </Text>
                                    </View>
                                )}
                                {formatPrice(service) && (
                                    <View style={styles.priceContainer}>
                                        <Text style={[styles.priceText, serviceId === service.id && styles.priceTextSelected]}>
                                            {formatPrice(service)}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Шаг 3: Мастер */}
            {branchId && serviceId && staffByBranch.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.stepIndicator, step >= 3 && styles.stepIndicatorActive]}>
                            <Text style={[styles.stepNumber, step >= 3 && styles.stepNumberActive]}>3</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Выберите мастера</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {staffByBranch.map((staff) => (
                            <TouchableOpacity
                                key={staff.id}
                                style={[styles.optionCard, staffId === staff.id && styles.optionCardSelected]}
                                onPress={() => {
                                    setStaffId(staff.id);
                                    setSelectedSlot(null);
                                }}
                            >
                                <Ionicons 
                                    name="person" 
                                    size={20} 
                                    color={staffId === staff.id ? '#6366f1' : '#6b7280'} 
                                />
                                <Text
                                    style={[
                                        styles.optionCardText,
                                        staffId === staff.id && styles.optionCardTextSelected,
                                    ]}
                                >
                                    {staff.full_name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Шаг 4: Дата */}
            {branchId && serviceId && staffId && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.stepIndicator, step >= 4 && styles.stepIndicatorActive]}>
                            <Text style={[styles.stepNumber, step >= 4 && styles.stepNumberActive]}>4</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Выберите дату</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {getAvailableDates().map((date) => {
                            const dateLabel = formatDateLabel(date);
                            const isToday = date === formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
                            return (
                                <TouchableOpacity
                                    key={date}
                                    style={[
                                        styles.dateCard,
                                        selectedDate === date && styles.dateCardSelected,
                                        isToday && styles.dateCardToday,
                                    ]}
                                    onPress={() => {
                                        setSelectedDate(date);
                                        setSelectedSlot(null);
                                    }}
                                >
                                    {isToday && (
                                        <Text style={[styles.todayLabel, selectedDate === date && styles.todayLabelSelected]}>
                                            Сегодня
                                        </Text>
                                    )}
                                    <Text
                                        style={[
                                            styles.dateDay,
                                            selectedDate === date && styles.dateDaySelected,
                                        ]}
                                    >
                                        {dateLabel.day}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.dateMonth,
                                            selectedDate === date && styles.dateMonthSelected,
                                        ]}
                                    >
                                        {dateLabel.month}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.dateWeekday,
                                            selectedDate === date && styles.dateWeekdaySelected,
                                        ]}
                                    >
                                        {dateLabel.weekday}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* Шаг 5: Время */}
            {branchId && serviceId && staffId && selectedDate && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.stepIndicator, step >= 5 && styles.stepIndicatorActive]}>
                            <Text style={[styles.stepNumber, step >= 5 && styles.stepNumberActive]}>5</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Выберите время</Text>
                    </View>
                    {slotsLoading ? (
                        <View style={styles.slotsLoadingContainer}>
                            <ActivityIndicator size="small" color="#6366f1" />
                            <Text style={styles.slotsLoadingText}>Загрузка доступного времени...</Text>
                        </View>
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
                                        {formatTimeSlot(slot.start_at)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.noSlotsContainer}>
                            <Ionicons name="time-outline" size={48} color="#9ca3af" />
                            <Text style={styles.noSlotsText}>Нет доступного времени</Text>
                            <Text style={styles.noSlotsHint}>Попробуйте выбрать другую дату</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Шаг 6: Подтверждение */}
            {selectedSlot && selectedService && selectedStaff && (
                <View style={styles.summarySection}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.stepIndicator, styles.stepIndicatorActive]}>
                            <Ionicons name="checkmark" size={16} color="#fff" />
                        </View>
                        <Text style={styles.sectionTitle}>Подтверждение записи</Text>
                    </View>
                    <Card style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Ionicons name="business-outline" size={20} color="#6366f1" />
                            <View style={styles.summaryContent}>
                                <Text style={styles.summaryLabel}>Бизнес</Text>
                                <Text style={styles.summaryValue}>{businessData.business.name}</Text>
                            </View>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryRow}>
                            <Ionicons name="cut-outline" size={20} color="#6366f1" />
                            <View style={styles.summaryContent}>
                                <Text style={styles.summaryLabel}>Услуга</Text>
                                <Text style={styles.summaryValue}>{selectedService.name_ru}</Text>
                                {selectedService.duration_min && (
                                    <Text style={styles.summaryHint}>{selectedService.duration_min} минут</Text>
                                )}
                                {formatPrice(selectedService) && (
                                    <Text style={styles.summaryPrice}>{formatPrice(selectedService)}</Text>
                                )}
                            </View>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryRow}>
                            <Ionicons name="person-outline" size={20} color="#6366f1" />
                            <View style={styles.summaryContent}>
                                <Text style={styles.summaryLabel}>Мастер</Text>
                                <Text style={styles.summaryValue}>{selectedStaff.full_name}</Text>
                            </View>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryRow}>
                            <Ionicons name="calendar-outline" size={20} color="#6366f1" />
                            <View style={styles.summaryContent}>
                                <Text style={styles.summaryLabel}>Дата и время</Text>
                                <Text style={styles.summaryValue}>
                                    {formatDateLabel(selectedDate).day} {formatDateLabel(selectedDate).month}
                                </Text>
                                <Text style={styles.summaryHint}>{formatTimeSlot(selectedSlot.start_at)}</Text>
                            </View>
                        </View>
                    </Card>

                    <Button
                        title="Записаться"
                        onPress={handleCreateBooking}
                        loading={createBookingMutation.isPending}
                        disabled={createBookingMutation.isPending || !selectedSlot}
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
    content: {
        paddingBottom: 40,
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
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
    section: {
        padding: 20,
        paddingBottom: 0,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    stepIndicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e5e7eb',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    stepIndicatorActive: {
        backgroundColor: '#6366f1',
    },
    stepNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    stepNumberActive: {
        color: '#fff',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    horizontalScroll: {
        marginHorizontal: -4,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#e5e7eb',
        marginRight: 12,
        marginBottom: 12,
        minWidth: 120,
        gap: 8,
    },
    optionCardSelected: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    optionCardText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#374151',
    },
    optionCardTextSelected: {
        color: '#fff',
    },
    serviceCard: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#e5e7eb',
        marginRight: 12,
        marginBottom: 12,
        minWidth: 160,
    },
    serviceCardSelected: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    serviceNameSelected: {
        color: '#fff',
    },
    serviceMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 8,
    },
    serviceDuration: {
        fontSize: 13,
        color: '#6b7280',
    },
    serviceDurationSelected: {
        color: '#fff',
    },
    priceContainer: {
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    priceText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#059669', // Яркий зеленый для контраста
    },
    priceTextSelected: {
        color: '#fff',
        borderTopColor: 'rgba(255, 255, 255, 0.3)',
    },
    dateCard: {
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#e5e7eb',
        marginRight: 12,
        marginBottom: 12,
        minWidth: 80,
        alignItems: 'center',
    },
    dateCardSelected: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    dateCardToday: {
        borderColor: '#10b981',
    },
    todayLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#10b981',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    todayLabelSelected: {
        color: '#fff',
    },
    dateDay: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    dateDaySelected: {
        color: '#fff',
    },
    dateMonth: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    dateMonthSelected: {
        color: '#fff',
    },
    dateWeekday: {
        fontSize: 11,
        color: '#9ca3af',
        marginTop: 4,
        textTransform: 'uppercase',
    },
    dateWeekdaySelected: {
        color: '#fff',
    },
    slotsLoadingContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    slotsLoadingText: {
        fontSize: 14,
        color: '#6b7280',
    },
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    slotButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#e5e7eb',
        minWidth: 80,
        alignItems: 'center',
    },
    slotButtonSelected: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    slotText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    slotTextSelected: {
        color: '#fff',
    },
    noSlotsContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    noSlotsText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    noSlotsHint: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        padding: 20,
    },
    summarySection: {
        padding: 20,
    },
    summaryCard: {
        marginBottom: 20,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
    },
    summaryContent: {
        flex: 1,
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6b7280',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    summaryHint: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 2,
    },
    summaryPrice: {
        fontSize: 18,
        fontWeight: '700',
        color: '#059669',
        marginTop: 4,
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 4,
    },
    createButton: {
        marginTop: 0,
    },
});
