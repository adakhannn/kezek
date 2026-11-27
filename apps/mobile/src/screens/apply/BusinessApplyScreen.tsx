import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ErrorState from '../../components/ui/ErrorState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import Screen from '../../components/ui/Screen';
import { SkeletonCard } from '../../components/ui/Skeleton';
import MotionPressable from '../../components/ui/MotionPressable';
import { colors } from '../../constants/colors';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import { useNavigationSession } from '../../navigation/NavigationSessionContext';
import type { RootStackParamList } from '../../navigation/types';
import { ApplicationAuthGate } from './ApplicationAuthGate';
import { fetchBusinessApplicationDefaults, submitBusinessApplication } from './applicationApi';
import {
    EMPTY_BUSINESS_APPLICATION,
    PROPOSE_CATEGORY_VALUE,
    businessApplicationError,
    businessApplicationErrorKey,
    resolveCategory,
    type BusinessApplicationForm,
} from './applicationModel';
import { applyStyles as styles } from './applyStyles';

type Field = keyof BusinessApplicationForm;

const LINK_FIELDS: { field: Field; label: MobileI18nKey | 'Instagram'; placeholder: string }[] = [
    { field: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
    { field: 'two_gis', label: 'parity.apply.links.twoGis', placeholder: 'https://2gis.ru/...' },
    { field: 'google_maps', label: 'parity.apply.links.googleMaps', placeholder: 'https://maps.google.com/...' },
    { field: 'yandex_maps', label: 'parity.apply.links.yandexMaps', placeholder: 'https://yandex.ru/maps/...' },
];

/** The website's /business/apply: connect a new business to Kezek (an application to the admins). */
export default function BusinessApplyScreen() {
    const { t } = useLanguage();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { hasSession } = useNavigationSession();
    const [form, setForm] = useState<BusinessApplicationForm>(EMPTY_BUSINESS_APPLICATION);
    const [categoryChoice, setCategoryChoice] = useState('');
    const [proposedCategory, setProposedCategory] = useState('');
    const [errorKey, setErrorKey] = useState<MobileI18nKey | null>(null);
    const [sent, setSent] = useState(false);
    const prefilled = useRef(false);
    const scrollRef = useRef<ScrollView>(null);

    const defaultsQuery = useQuery({
        queryKey: ['business-application-defaults'],
        queryFn: fetchBusinessApplicationDefaults,
        enabled: hasSession,
    });
    const categories = defaultsQuery.data?.categories ?? [];

    useEffect(() => {
        const defaults = defaultsQuery.data;
        if (!defaults || prefilled.current) return;
        prefilled.current = true;
        setForm((current) => ({
            ...current,
            contact_name: current.contact_name || defaults.contact_name,
            phone: current.phone || defaults.phone,
            email: current.email || defaults.email,
        }));
        if (!defaults.categories.length) setCategoryChoice(PROPOSE_CATEGORY_VALUE);
    }, [defaultsQuery.data]);

    const submit = useMutation({
        mutationFn: () => submitBusinessApplication(trimmed(form), resolveCategory(categoryChoice, proposedCategory)),
        onSuccess: () => {
            setSent(true);
            setForm({ ...EMPTY_BUSINESS_APPLICATION });
            setProposedCategory('');
            setCategoryChoice(categories.length ? '' : PROPOSE_CATEGORY_VALUE);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
        },
        onError: (error: unknown) => {
            setErrorKey(businessApplicationErrorKey(error));
            scrollRef.current?.scrollTo({ y: 0, animated: true });
        },
    });

    const field = (name: Field) => ({
        value: form[name],
        onChangeText: (value: string) => {
            setForm((current) => ({ ...current, [name]: value }));
            setErrorKey(null);
        },
        editable: !submit.isPending,
    });

    const onSubmit = () => {
        const error = businessApplicationError(form, categoryChoice, proposedCategory);
        if (error) {
            setErrorKey(error);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            return;
        }
        setErrorKey(null);
        submit.mutate();
    };

    const header = (
        <View style={styles.intro}>
            <Text style={styles.description}>
                {hasSession ? t('parity.apply.page.authenticatedDescription') : t('parity.apply.page.guestDescription')}
            </Text>
        </View>
    );

    if (!hasSession) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="business-apply-screen">
                {header}
                <ApplicationAuthGate />
            </ScrollView>
        );
    }

    if (defaultsQuery.isLoading) {
        return (
            <Screen>
                <SkeletonCard lines={1} />
                <SkeletonCard lines={5} />
            </Screen>
        );
    }

    if (defaultsQuery.isError) {
        return (
            <Screen>
                <ErrorState
                    title={t('parity.apply.loadError')}
                    retryLabel={t('cabinet.ui.retry')}
                    onRetry={() => void defaultsQuery.refetch()}
                />
            </Screen>
        );
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
                ref={scrollRef}
                style={styles.container}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                automaticallyAdjustKeyboardInsets
                testID="business-apply-screen"
            >
                {header}

                <Card variant="plain" padding="md" style={styles.cardGap}>
                    <Text style={styles.hint}>{t('parity.apply.existing.prefix')}</Text>
                    <Button
                        title={t('parity.apply.existing.link')}
                        onPress={() => navigation.navigate('RoleApplication', { mode: 'owner' })}
                        variant="ghost"
                        size="sm"
                    />
                </Card>

                {sent ? (
                    <FeedbackBanner
                        variant="success"
                        title={t('parity.apply.success.title')}
                        message={t('parity.apply.success.message')}
                        onClose={() => setSent(false)}
                    />
                ) : null}
                {errorKey ? <FeedbackBanner variant="danger" message={t(errorKey)} onClose={() => setErrorKey(null)} /> : null}

                {!sent ? (
                    <Card variant="plain" padding="md" style={styles.cardGap}>
                        <Input label={t('parity.apply.field.contactName')} autoComplete="name" {...field('contact_name')} />
                        <Input
                            label={t('parity.apply.field.phone')}
                            placeholder={t('parity.apply.field.phonePlaceholder')}
                            helperText={t('parity.apply.field.phoneHint')}
                            keyboardType="phone-pad"
                            autoComplete="tel"
                            {...field('phone')}
                        />
                        <Input label={t('cabinet.profile.email.label')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" {...field('email')} />
                        <Input label={t('parity.apply.field.businessName')} {...field('business_name')} />

                        <View>
                            <Text style={styles.label}>{t('parity.apply.field.category')}</Text>
                            <Text style={[styles.hint, styles.hintGap]}>{t('parity.apply.category.helper')}</Text>
                            <View style={styles.optionsList} accessibilityRole="radiogroup">
                                {[...categories.map((category) => ({ value: category.slug, label: category.name })),
                                    { value: PROPOSE_CATEGORY_VALUE, label: t('parity.apply.category.propose') }].map((option) => {
                                    const selected = categoryChoice === option.value;
                                    return (
                                        <MotionPressable
                                            key={option.value}
                                            onPress={() => {
                                                setCategoryChoice(option.value);
                                                setErrorKey(null);
                                            }}
                                            style={[styles.option, selected ? styles.optionSelected : null]}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                            accessibilityLabel={option.label}
                                            testID={`category-${option.value}`}
                                        >
                                            <Ionicons
                                                name={selected ? 'radio-button-on' : 'radio-button-off'}
                                                size={20}
                                                color={selected ? colors.accent.indigo : colors.text.tertiary}
                                            />
                                            <Text style={styles.optionText}>{option.label}</Text>
                                        </MotionPressable>
                                    );
                                })}
                            </View>
                        </View>

                        {categoryChoice === PROPOSE_CATEGORY_VALUE ? (
                            <Input
                                label={t('parity.apply.proposedCategory.label')}
                                placeholder={t('parity.apply.proposedCategory.placeholder')}
                                helperText={t('parity.apply.proposedCategory.helper')}
                                maxLength={120}
                                value={proposedCategory}
                                onChangeText={(value) => {
                                    setProposedCategory(value);
                                    setErrorKey(null);
                                }}
                                testID="proposed-category-input"
                            />
                        ) : null}

                        <View>
                            <Text style={styles.label}>{t('parity.apply.field.comment')}</Text>
                            <TextInput
                                style={styles.textArea}
                                multiline
                                maxLength={2000}
                                accessibilityLabel={t('parity.apply.field.comment')}
                                placeholderTextColor={colors.text.tertiary}
                                {...field('comment')}
                            />
                        </View>
                    </Card>
                ) : null}

                {!sent ? (
                    <Card variant="plain" padding="md" style={styles.cardGap}>
                        <Text style={styles.label}>{t('parity.apply.links.title')}</Text>
                        <Text style={styles.hint}>{t('parity.apply.links.description')}</Text>
                        {LINK_FIELDS.map(({ field: name, label, placeholder }) => (
                            <Input
                                key={name}
                                label={label === 'Instagram' ? label : t(label)}
                                placeholder={placeholder}
                                keyboardType="url"
                                autoCapitalize="none"
                                autoCorrect={false}
                                {...field(name)}
                            />
                        ))}
                    </Card>
                ) : null}

                {!sent ? (
                    <>
                        <Text style={styles.muted}>{t('parity.apply.consent')}</Text>
                        <Button
                            title={t('parity.apply.submit')}
                            onPress={onSubmit}
                            loading={submit.isPending}
                            disabled={submit.isPending}
                            fullWidth
                        />
                    </>
                ) : (
                    <Button title={t('parity.apply.newApplication')} onPress={() => setSent(false)} variant="outline" fullWidth />
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function trimmed(form: BusinessApplicationForm): BusinessApplicationForm {
    return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as BusinessApplicationForm;
}
