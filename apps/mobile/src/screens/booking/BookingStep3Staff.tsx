import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import Button from '../../components/ui/Button';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import RatingBadge from '../../components/ui/RatingBadge';

type NavigationProp = NativeStackNavigationProp<any>;

export default function BookingStep3Staff() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setStaff, setStaffId } = useBooking();

    const { data: staffData, isLoading } = useQuery({
        queryKey: ['staff', bookingData.business?.id, bookingData.branchId],
        queryFn: async () => {
            if (!bookingData.business?.id || !bookingData.branchId) return [];

            const { data, error } = await supabase
                .from('staff')
                .select('id, full_name, branch_id, rating_score, avatar_url')
                .eq('biz_id', bookingData.business.id)
                .eq('branch_id', bookingData.branchId)
                .eq('is_active', true)
                .order('rating_score', { ascending: false, nullsFirst: false })
                .order('full_name');

            if (error) throw error;
            return data || [];
        },
        enabled: !!bookingData.business?.id && !!bookingData.branchId,
    });

    useEffect(() => {
        if (staffData) {
            setStaff(staffData);
            if (staffData.length === 1) {
                setStaffId(staffData[0].id);
            }
        }
    }, [staffData, setStaff, setStaffId]);

    const handleSelectStaff = (staffId: string) => {
        setStaffId(staffId);
    };

    const handleNext = () => {
        if (bookingData.staffId) {
            // @ts-ignore
            navigation.navigate('BookingStep4Date');
        }
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Загрузка мастеров...</Text>
            </View>
        );
    }

    if (!staffData || staffData.length === 0) {
        return (
            <LinearGradient
                colors={[colors.background.gradient.from, colors.background.gradient.via, colors.background.gradient.to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientContainer}
            >
                <View style={styles.container}>
                    <BookingProgressIndicator currentStep={3} />
                    <View style={styles.header}>
                        <Text style={styles.title}>{bookingData.business?.name}</Text>
                    </View>
                    <View style={styles.emptyContainer}>
                        <Ionicons name="person-outline" size={48} color={colors.text.tertiary} />
                        <Text style={styles.emptyText}>Нет доступных мастеров</Text>
                    </View>
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={[colors.background.gradient.from, colors.background.gradient.via, colors.background.gradient.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <BookingProgressIndicator currentStep={3} />
                <View style={styles.header}>
                    <Text style={styles.title}>{bookingData.business?.name}</Text>
                </View>

                <View style={styles.section}>
                    <View style={styles.optionsList}>
                        {staffData.map((staff) => {
                            const isSelected = bookingData.staffId === staff.id;
                            return (
                                <TouchableOpacity
                                    key={staff.id}
                                    style={styles.chipContainer}
                                    onPress={() => handleSelectStaff(staff.id)}
                                    activeOpacity={0.7}
                                >
                                    {isSelected ? (
                                        <LinearGradient
                                            colors={['rgba(79, 70, 229, 0.1)', 'rgba(79, 70, 229, 0.15)']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.chipSelected}
                                        >
                                            <View style={styles.chipContent}>
                                                <Text style={styles.chipTextSelected}>{staff.full_name}</Text>
                                                {staff.rating_score !== null && staff.rating_score !== undefined && (
                                                    <RatingBadge rating={staff.rating_score} size="small" />
                                                )}
                                            </View>
                                        </LinearGradient>
                                    ) : (
                                        <View style={styles.chip}>
                                            <View style={styles.chipContent}>
                                                <Text style={styles.chipText}>{staff.full_name}</Text>
                                                {staff.rating_score !== null && staff.rating_score !== undefined && (
                                                    <RatingBadge rating={staff.rating_score} size="small" />
                                                )}
                                            </View>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {staffData.length > 0 && (
                        <View style={styles.buttonContainer}>
                            <Button
                                title="Назад"
                                onPress={() => navigation.goBack()}
                                variant="outline"
                                style={styles.backButton}
                            />
                            <Button
                                title="Дальше"
                                onPress={handleNext}
                                disabled={!bookingData.staffId}
                                variant="primary"
                                style={styles.nextButton}
                            />
                        </View>
                    )}
                </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    content: {
        paddingBottom: 40,
    },
    header: {
        padding: 20,
        paddingTop: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 4,
    },
    loadingText: {
        textAlign: 'center',
        padding: 40,
        color: colors.text.secondary,
    },
    section: {
        padding: 20,
    },
    optionsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chipContainer: {
        marginBottom: 4,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.background.secondary,
    },
    chipSelected: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.primary.from,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.text.primary,
    },
    chipTextSelected: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.primary.from,
    },
    chipContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    buttonContainer: {
        marginTop: 24,
        paddingHorizontal: 0,
        flexDirection: 'row',
        gap: 12,
    },
    backButton: {
        flex: 1,
    },
    nextButton: {
        flex: 1,
    },
});
