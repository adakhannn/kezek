import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import Input from '../../../components/ui/Input';
import { colors } from '../../../constants/colors';
import { useLanguage } from '../../../i18n';
import { getApiErrorStatus } from '../../../lib/errors';
import type { RootStackParamList } from '../../../navigation/types';
import { catalogApi, catalogKeys, type BusinessSettings, type ContactFields } from './catalogApi';
import { apiErrorBody, catalogErrorText } from './catalogErrors';
import { QueryState, SectionTitle, ui } from './catalogUi';
import { timeZoneLabel, timeZoneOptions } from './settings';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageSettings'>;
type Message = { variant: 'success' | 'danger'; text: string } | null;

/** The website's /dashboard/settings: the business's public contacts and its time zone (owner only). */
export default function BusinessSettingsScreen({ route }: Props) {
    const { bizId, bizName } = route.params;
    const { t } = useLanguage();
    const query = useQuery({ queryKey: catalogKeys.settings(bizId), queryFn: () => catalogApi.settings(bizId) });

    // 403: the page's own "no access" notice, not a load error.
    if (getApiErrorStatus(query.error) === 403) {
        return (
            <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
                <FeedbackBanner
                    variant="danger"
                    title={t('catalog.business.contactSettings.noAccessTitle')}
                    message={t('catalog.business.contactSettings.noAccessDescription')}
                />
            </ScrollView>
        );
    }

    return (
        <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
            {() => (
                <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" testID="manage-settings-screen">
                        <View style={ui.header}>
                            <Text style={ui.title} accessibilityRole="header">{t('catalog.business.contactSettings.title')}</Text>
                            <Text style={ui.subtitle}>
                                {t('catalog.business.contactSettings.publicContacts')} {bizName || t('catalog.business.contactSettings.selectedBusiness')}
                            </Text>
                        </View>
                        <ContactsForm bizId={bizId} initial={query.data!} />
                        <TimeZoneForm bizId={bizId} initial={query.data!.tz} />
                    </ScrollView>
                </KeyboardAvoidingView>
            )}
        </QueryState>
    );
}

const FIELDS: { field: keyof ContactFields; label: 'catalog.business.contactSettings.phone' | 'catalog.business.contactSettings.whatsapp' | 'catalog.business.contactSettings.email' | 'catalog.business.contactSettings.website'; hint?: 'catalog.business.contactSettings.phoneHint' | 'catalog.business.contactSettings.whatsappHint' | 'catalog.business.contactSettings.websiteHint'; placeholder: string; keyboard: 'phone-pad' | 'email-address' | 'url' }[] = [
    { field: 'contact_phone', label: 'catalog.business.contactSettings.phone', hint: 'catalog.business.contactSettings.phoneHint', placeholder: '+996555123456', keyboard: 'phone-pad' },
    { field: 'contact_whatsapp', label: 'catalog.business.contactSettings.whatsapp', hint: 'catalog.business.contactSettings.whatsappHint', placeholder: '+996555123456', keyboard: 'phone-pad' },
    { field: 'contact_email', label: 'catalog.business.contactSettings.email', placeholder: 'hello@example.com', keyboard: 'email-address' },
    { field: 'website_url', label: 'catalog.business.contactSettings.website', hint: 'catalog.business.contactSettings.websiteHint', placeholder: 'https://example.com', keyboard: 'url' },
];

function contactsFrom(data: Partial<ContactFields> | null | undefined): Record<keyof ContactFields, string> {
    return {
        contact_phone: data?.contact_phone ?? '',
        contact_whatsapp: data?.contact_whatsapp ?? '',
        contact_email: data?.contact_email ?? '',
        website_url: data?.website_url ?? '',
    };
}

function ContactsForm({ bizId, initial }: { bizId: string; initial: BusinessSettings }) {
    const { t } = useLanguage();
    const queryClient = useQueryClient();
    const [form, setForm] = useState(() => contactsFrom(initial));
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<Message>(null);

    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const saved = await catalogApi.saveSettings(bizId, form);
            setForm(contactsFrom(saved));
            queryClient.setQueryData<BusinessSettings>(catalogKeys.settings(bizId), (current) => current && saved ? { ...current, ...saved } : current);
            setMessage({ variant: 'success', text: t('catalog.business.contactSettings.saved') });
        } catch (error) {
            setMessage({
                variant: 'danger',
                text: getApiErrorStatus(error) === undefined
                    ? t('catalog.business.contactSettings.networkError')
                    : catalogErrorText(error, t('catalog.business.contactSettings.saveError'), t),
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {message ? <FeedbackBanner variant={message.variant} message={message.text} /> : null}
            <Card padding="md">
                <SectionTitle title={t('catalog.business.contactSettings.heading')} subtitle={t('catalog.business.contactSettings.description')} />
                {FIELDS.map(({ field, label, hint, placeholder, keyboard }) => (
                    <Input
                        key={field}
                        label={t(label)}
                        value={form[field]}
                        onChangeText={(value) => setForm((current) => ({ ...current, [field]: value }))}
                        placeholder={placeholder}
                        helperText={hint ? t(hint) : undefined}
                        keyboardType={keyboard}
                        autoCapitalize="none"
                        autoCorrect={false}
                        testID={`settings-${field}`}
                    />
                ))}
            </Card>
            <Button title={t('catalog.business.contactSettings.save')} onPress={() => void save()} loading={saving} fullWidth />
        </>
    );
}

function TimeZoneForm({ bizId, initial }: { bizId: string; initial: string }) {
    const { t } = useLanguage();
    const queryClient = useQueryClient();
    const [tz, setTz] = useState(initial);
    const [saved, setSaved] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [picking, setPicking] = useState(false);
    const [message, setMessage] = useState<Message>(null);
    const options = useMemo(() => timeZoneOptions(saved), [saved]);

    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const result = await catalogApi.saveSettings(bizId, { tz });
            const next = typeof result?.tz === 'string' ? result.tz : tz;
            setTz(next);
            setSaved(next);
            queryClient.setQueryData<BusinessSettings>(catalogKeys.settings(bizId), (current) => current && { ...current, tz: next });
            setMessage({ variant: 'success', text: t('catalog.business.timeZoneSettings.saved') });
        } catch (error) {
            setMessage({
                variant: 'danger',
                text: apiErrorBody(error)?.error === 'tz_has_future_bookings'
                    ? t('catalog.business.timeZoneSettings.futureBookings')
                    : getApiErrorStatus(error) === undefined
                        ? t('catalog.business.contactSettings.networkError')
                        : catalogErrorText(error, t('catalog.business.timeZoneSettings.saveError'), t),
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {message ? <FeedbackBanner variant={message.variant} message={message.text} /> : null}
            <Card padding="md">
                <SectionTitle title={t('catalog.business.timeZoneSettings.heading')} subtitle={t('catalog.business.timeZoneSettings.description')} />
                <Text style={ui.muted}>{t('catalog.business.timeZoneSettings.label')}</Text>
                <Pressable
                    onPress={() => setPicking(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('catalog.business.timeZoneSettings.label')}: ${timeZoneLabel(tz)}`}
                    accessibilityHint={t('catalog.app.chooseTimeZone')}
                    style={({ pressed }) => [{
                        marginTop: 6,
                        minHeight: 48,
                        borderWidth: 1,
                        borderColor: colors.border.light,
                        borderRadius: colors.layout.radiusMd,
                        backgroundColor: colors.surface.card,
                        paddingHorizontal: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }, pressed ? ui.pressed : null]}
                    testID="settings-tz"
                >
                    <Text style={ui.body}>{timeZoneLabel(tz)}</Text>
                    <Ionicons name="chevron-down" size={18} color={colors.text.secondary} />
                </Pressable>
                <Text style={[ui.caption, { marginTop: 6 }]}>{t('catalog.business.timeZoneSettings.hint')}</Text>
            </Card>
            <Button
                title={t('catalog.business.timeZoneSettings.save')}
                onPress={() => void save()}
                loading={saving}
                disabled={tz === saved}
                fullWidth
            />
            <Modal visible={picking} animationType="slide" transparent onRequestClose={() => setPicking(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay }}>
                    <View style={{ maxHeight: '75%', backgroundColor: colors.surface.page, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
                        <View style={ui.rowBetween}>
                            <Text style={ui.sectionTitle} accessibilityRole="header">{t('catalog.app.chooseTimeZone')}</Text>
                            <Pressable
                                onPress={() => setPicking(false)}
                                accessibilityRole="button"
                                accessibilityLabel={t('catalog.common.cancel')}
                                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Ionicons name="close" size={22} color={colors.text.primary} />
                            </Pressable>
                        </View>
                        <ScrollView>
                            {options.map((zone) => {
                                const selected = zone === tz;
                                return (
                                    <Pressable
                                        key={zone}
                                        onPress={() => { setTz(zone); setPicking(false); setMessage(null); }}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected, checked: selected }}
                                        style={({ pressed }) => [{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed ? ui.pressed : null]}
                                        testID={`tz-${zone}`}
                                    >
                                        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.accent.indigo : colors.text.secondary} />
                                        <Text style={ui.body}>{timeZoneLabel(zone)}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}
