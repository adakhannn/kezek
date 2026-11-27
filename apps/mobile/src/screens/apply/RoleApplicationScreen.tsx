import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import MotionPressable from '../../components/ui/MotionPressable';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';
import { getErrorMessage } from '../../lib/errors';
import { useNavigationSession } from '../../navigation/NavigationSessionContext';
import type { RootStackParamList } from '../../navigation/types';
import { formatDate } from '../../utils/format';
import {
    cancelRoleApplication,
    fetchMyRoleApplications,
    fetchProfileHasName,
    searchBusinesses,
    submitRoleApplication,
} from './applicationApi';
import {
    EMPTY_EVIDENCE,
    MIN_BUSINESS_QUERY,
    applicationBusinessName,
    roleApplicationError,
    type BusinessOption,
    type EvidenceLinks,
} from './applicationModel';
import { applyStyles as styles } from './applyStyles';

type Route = RouteProp<RootStackParamList, 'RoleApplication'>;

const EVIDENCE_FIELDS: { key: keyof EvidenceLinks; label: 'Instagram' | 'parity.apply.links.twoGis' | 'parity.apply.links.googleMaps' | 'parity.apply.links.yandexMaps' }[] = [
    { key: 'instagram', label: 'Instagram' },
    { key: 'two_gis', label: 'parity.apply.links.twoGis' },
    { key: 'google_maps', label: 'parity.apply.links.googleMaps' },
    { key: 'yandex_maps', label: 'parity.apply.links.yandexMaps' },
];

/**
 * The website's /business/owner-apply and /business/staff-apply: find an approved business, send an
 * owner or staff application, see the pending ones and withdraw them.
 */
export default function RoleApplicationScreen() {
    const { t, locale } = useLanguage();
    const { params } = useRoute<Route>();
    const mode = params?.mode === 'owner' ? 'owner' : 'staff';
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const queryClient = useQueryClient();
    const { hasSession } = useNavigationSession();
    const page = mode === 'owner' ? 'parity.roleApply.ownerPage' : 'parity.roleApply.staffPage';

    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [selected, setSelected] = useState<BusinessOption | null>(null);
    const [message, setMessage] = useState('');
    const [showComment, setShowComment] = useState(false);
    const [evidence, setEvidence] = useState<EvidenceLinks>(EMPTY_EVIDENCE);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(query.trim()), 250);
        return () => clearTimeout(timer);
    }, [query]);

    const searching = !selected && debounced.length >= MIN_BUSINESS_QUERY;
    const searchQuery = useQuery({
        queryKey: ['business-search', debounced],
        queryFn: ({ signal }) => searchBusinesses(debounced, signal),
        enabled: searching,
    });

    const applicationsKey = ['my-role-applications', mode];
    const applicationsQuery = useQuery({
        queryKey: applicationsKey,
        queryFn: () => fetchMyRoleApplications(mode),
        enabled: hasSession,
    });
    const nameQuery = useQuery({
        queryKey: ['profile-has-name'],
        queryFn: fetchProfileHasName,
        enabled: hasSession && mode === 'staff',
    });

    const scrollTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

    const submit = useMutation({
        mutationFn: () => submitRoleApplication({ bizId: selected?.id ?? '', mode, message, evidence }),
        onSuccess: () => {
            setSuccess(selected
                ? t(mode === 'owner' ? 'parity.roleApply.form.success.ownerTo' : 'parity.roleApply.form.success.staffTo', { business: selected.name })
                : t(mode === 'owner' ? 'parity.roleApply.form.success.owner' : 'parity.roleApply.form.success.staff'));
            setMessage('');
            setEvidence(EMPTY_EVIDENCE);
            void queryClient.invalidateQueries({ queryKey: applicationsKey });
            scrollTop();
        },
        onError: (submitError: unknown) => {
            setError(getErrorMessage(submitError, t('parity.roleApply.form.errors.submit'), t));
            scrollTop();
        },
    });

    const cancel = useMutation({
        mutationFn: cancelRoleApplication,
        onSuccess: () => {
            setSuccess(t('parity.roleApply.form.cancelled'));
            void queryClient.invalidateQueries({ queryKey: applicationsKey });
        },
        onError: (cancelError: unknown) => setError(getErrorMessage(cancelError, t('parity.roleApply.form.errors.cancel'), t)),
    });

    const onSubmit = () => {
        setError(null);
        setSuccess(null);
        const problem = roleApplicationError({ mode, bizId: selected?.id ?? '', message, evidence });
        if (problem) {
            setError(t(problem));
            scrollTop();
            return;
        }
        submit.mutate();
    };

    const applications = applicationsQuery.data ?? [];

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
                ref={scrollRef}
                style={styles.container}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                automaticallyAdjustKeyboardInsets
                testID="role-application-screen"
            >
                <View style={styles.intro}>
                    <Text style={styles.eyebrow}>{t(`${page}.eyebrow`)}</Text>
                    <Text style={styles.title} accessibilityRole="header">{t(`${page}.title`)}</Text>
                    <Text style={styles.description}>{t(`${page}.description`)}</Text>
                </View>

                {!hasSession ? (
                    <FeedbackBanner
                        variant="warning"
                        title={t('parity.roleApply.form.auth.title')}
                        message={t(mode === 'owner' ? 'parity.roleApply.form.auth.ownerMessage' : 'parity.roleApply.form.auth.staffMessage')}
                        action={<Button title={t('parity.roleApply.form.signIn')} onPress={() => navigation.navigate('Auth', { screen: 'SignIn' })} size="sm" />}
                    />
                ) : null}
                {error ? <FeedbackBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}
                {success ? (
                    <FeedbackBanner variant="success" title={t('parity.roleApply.form.success.title')} message={success} onClose={() => setSuccess(null)} />
                ) : null}
                {applicationsQuery.isError ? (
                    <FeedbackBanner
                        variant="danger"
                        message={t('parity.roleApply.form.errors.loadActive')}
                        action={<Button title={t('cabinet.ui.retry')} onPress={() => void applicationsQuery.refetch()} variant="outline" size="sm" />}
                    />
                ) : null}

                {applications.length ? (
                    <View style={styles.warningBox} testID="role-applications-active">
                        <Text style={styles.label}>{t('parity.roleApply.form.active.title')}</Text>
                        {applications.map((application) => (
                            <View key={application.id} style={styles.row}>
                                <Text style={styles.rowText}>
                                    {applicationBusinessName(application)} · {formatDate(application.created_at, locale)}
                                </Text>
                                <Button
                                    title={t('parity.roleApply.form.active.cancel')}
                                    onPress={() => cancel.mutate(application.id)}
                                    variant="outline"
                                    size="sm"
                                    loading={cancel.isPending && cancel.variables === application.id}
                                    disabled={cancel.isPending}
                                />
                            </View>
                        ))}
                    </View>
                ) : null}

                {mode === 'staff' && hasSession && nameQuery.data === false ? (
                    <Card variant="plain" padding="md" style={styles.cardGap}>
                        <Text style={styles.hint}>{t('parity.roleApply.form.applicant.missingName')}</Text>
                        <Button
                            title={t('parity.roleApply.form.applicant.edit')}
                            onPress={() => navigation.navigate('Main', { screen: 'Cabinet', params: { screen: 'Profile' } })}
                            variant="ghost"
                            size="sm"
                        />
                    </Card>
                ) : null}

                <Card variant="plain" padding="md" style={styles.cardGap}>
                    <Input
                        label={t('parity.roleApply.form.search.label')}
                        placeholder={t('parity.roleApply.form.search.placeholder')}
                        helperText={t('parity.roleApply.form.search.helper')}
                        value={query}
                        onChangeText={(value) => {
                            setQuery(value);
                            setSelected(null);
                            setError(null);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        testID="business-search-input"
                    />
                    {selected ? (
                        <View style={[styles.option, styles.optionSelected]} accessibilityLabel={selected.name}>
                            <Ionicons name="checkmark-circle" size={20} color={colors.accent.indigo} />
                            <Text style={styles.optionText} numberOfLines={2}>{selected.name}</Text>
                        </View>
                    ) : searching ? (
                        <View style={styles.optionsList} accessibilityRole="list">
                            {searchQuery.isLoading ? (
                                <Text style={styles.hint}>{t('parity.roleApply.form.business.loading')}</Text>
                            ) : searchQuery.isError ? (
                                <Text style={styles.hint}>{t('parity.roleApply.form.errors.loadBusinesses')}</Text>
                            ) : (searchQuery.data ?? []).length ? (
                                (searchQuery.data ?? []).map((business) => (
                                    <MotionPressable
                                        key={business.id}
                                        onPress={() => {
                                            setSelected(business);
                                            setQuery(business.name);
                                        }}
                                        style={styles.option}
                                        accessibilityRole="button"
                                        accessibilityLabel={business.name}
                                        testID={`business-option-${business.id}`}
                                    >
                                        <Ionicons name="business-outline" size={18} color={colors.text.secondary} />
                                        <Text style={styles.optionText} numberOfLines={2}>{business.name}</Text>
                                    </MotionPressable>
                                ))
                            ) : (
                                <Text style={styles.hint}>{t('parity.roleApply.form.business.empty')}</Text>
                            )}
                        </View>
                    ) : (
                        <Text style={styles.muted}>{t('parity.roleApply.form.business.prompt')}</Text>
                    )}
                </Card>

                {mode === 'owner' ? (
                    <Card variant="plain" padding="md" style={styles.cardGap}>
                        <Text style={styles.label}>{t('parity.roleApply.form.evidence.label')}</Text>
                        <Text style={styles.hint}>{t('parity.roleApply.form.evidence.helper')}</Text>
                        {EVIDENCE_FIELDS.map(({ key, label }) => (
                            <Input
                                key={key}
                                label={label === 'Instagram' ? label : t(label)}
                                placeholder="https://..."
                                value={evidence[key]}
                                onChangeText={(value) => setEvidence((current) => ({ ...current, [key]: value }))}
                                keyboardType="url"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        ))}
                    </Card>
                ) : null}

                <Card variant="plain" padding="md" style={styles.cardGap}>
                    <Text style={styles.hint}>
                        {t('parity.roleApply.form.role.label')}:{' '}
                        <Text style={styles.benefitTitle}>
                            {t(mode === 'owner' ? 'parity.roleApply.form.role.owner' : 'parity.roleApply.form.role.staff')}
                        </Text>
                    </Text>
                    <Text style={styles.muted}>
                        {t(mode === 'owner' ? 'parity.roleApply.form.role.ownerHint' : 'parity.roleApply.form.role.staffHint')}
                    </Text>
                    {mode === 'staff' && !showComment ? (
                        <Button title={t('parity.roleApply.form.comment.addOptional')} onPress={() => setShowComment(true)} variant="ghost" size="sm" />
                    ) : (
                        <View>
                            <Text style={styles.label}>
                                {t(mode === 'owner' ? 'parity.roleApply.form.comment.ownerLabel' : 'parity.roleApply.form.comment.staffLabel')}
                            </Text>
                            <TextInput
                                style={styles.textArea}
                                multiline
                                maxLength={2000}
                                value={message}
                                onChangeText={setMessage}
                                placeholder={t(mode === 'owner' ? 'parity.roleApply.form.comment.ownerPlaceholder' : 'parity.roleApply.form.comment.staffPlaceholder')}
                                placeholderTextColor={colors.text.tertiary}
                                accessibilityLabel={t(mode === 'owner' ? 'parity.roleApply.form.comment.ownerLabel' : 'parity.roleApply.form.comment.staffLabel')}
                                testID="role-application-message"
                            />
                        </View>
                    )}
                </Card>

                <View style={styles.infoBox}>
                    <Text style={styles.hint}>
                        {t(mode === 'owner' ? 'parity.roleApply.form.info.owner' : 'parity.roleApply.form.info.staff')}
                    </Text>
                </View>

                <Button
                    title={t('parity.roleApply.form.submit')}
                    onPress={onSubmit}
                    loading={submit.isPending}
                    disabled={submit.isPending || !hasSession || !selected}
                    fullWidth
                />
                <Button
                    title={t('parity.roleApply.form.chooseType')}
                    onPress={() => navigation.navigate('RoleApply')}
                    variant="outline"
                    fullWidth
                />
                <Button
                    title={t('parity.roleApply.form.connectBusiness')}
                    onPress={() => navigation.navigate('BusinessApply')}
                    variant="ghost"
                    fullWidth
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
