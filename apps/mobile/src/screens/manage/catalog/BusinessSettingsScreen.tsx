import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../../../components/ui/Button';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import FormField, { FieldGroup } from '../../../components/ui/FormField';
import ListRow, { ListGroup } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { RadioRow } from '../../../components/ui/SelectionRow';
import { MIN_TOUCH_TARGET } from '../../../constants/accessibility';
import { colors } from '../../../constants/colors';
import { layout, radii, space, typeScale } from '../../../constants/theme';
import { useLanguage } from '../../../i18n';
import { getApiErrorStatus } from '../../../lib/errors';
import type { RootStackParamList } from '../../../navigation/types';
import { catalogApi, catalogKeys, type BusinessSettings, type ContactFields } from './catalogApi';
import { apiErrorBody, catalogErrorText } from './catalogErrors';
import { QueryState } from './catalogUi';
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
            <Screen>
                <FeedbackBanner
                    variant="danger"
                    title={t('catalog.business.contactSettings.noAccessTitle')}
                    message={t('catalog.business.contactSettings.noAccessDescription')}
                />
            </Screen>
        );
    }

    return (
        <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} skeleton="form">
            {() => (
                <Screen keyboard testID="manage-settings-screen">
                    {/* The header says "Настройки": one muted line names the business. */}
                    <ScreenIntro>{bizName || t('catalog.business.contactSettings.selectedBusiness')}</ScreenIntro>
                    <ContactsForm bizId={bizId} initial={query.data!} />
                    <TimeZoneForm bizId={bizId} initial={query.data!.tz} />
                </Screen>
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
        <View style={styles.block}>
            {/* A page section like «Часовой пояс» below, not a small form eyebrow. */}
            <Section title={t('catalog.business.contactSettings.heading')} caption={t('catalog.business.contactSettings.description')}>
                <FieldGroup>
                    {FIELDS.map(({ field, label, hint, placeholder, keyboard }) => (
                        <FormField
                            key={field}
                            label={t(label)}
                            value={form[field]}
                            onChangeText={(value) => setForm((current) => ({ ...current, [field]: value }))}
                            placeholder={placeholder}
                            hint={hint ? t(hint) : undefined}
                            keyboardType={keyboard}
                            autoCapitalize="none"
                            autoCorrect={false}
                            testID={`settings-${field}`}
                        />
                    ))}
                </FieldGroup>
            </Section>
            {message ? <FeedbackBanner variant={message.variant} message={message.text} compact /> : null}
            <Button title={t('catalog.business.contactSettings.save')} onPress={() => void save()} loading={saving} fullWidth />
        </View>
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
        <Section title={t('catalog.business.timeZoneSettings.heading')} caption={t('catalog.business.timeZoneSettings.description')}>
            <ListGroup>
                <ListRow
                    icon="globe-outline"
                    title={timeZoneLabel(tz)}
                    subtitle={t('catalog.business.timeZoneSettings.label')}
                    onPress={() => setPicking(true)}
                    accessibilityHint={t('catalog.app.chooseTimeZone')}
                    testID="settings-tz"
                />
            </ListGroup>
            <Text style={styles.hint}>{t('catalog.business.timeZoneSettings.hint')}</Text>
            {message ? <FeedbackBanner variant={message.variant} message={message.text} compact /> : null}
            <Button
                title={t('catalog.business.timeZoneSettings.save')}
                onPress={() => void save()}
                loading={saving}
                disabled={tz === saved}
                variant="outline"
                fullWidth
            />
            <Modal visible={picking} animationType="slide" transparent onRequestClose={() => setPicking(false)}>
                <View style={styles.overlay}>
                    <View style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle} accessibilityRole="header">{t('catalog.app.chooseTimeZone')}</Text>
                            <Pressable
                                onPress={() => setPicking(false)}
                                accessibilityRole="button"
                                accessibilityLabel={t('catalog.common.cancel')}
                                style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
                            >
                                <Ionicons name="close" size={22} color={colors.text.primary} />
                            </Pressable>
                        </View>
                        <ScrollView contentContainerStyle={styles.sheetList}>
                            {options.map((zone) => (
                                <RadioRow
                                    key={zone}
                                    label={timeZoneLabel(zone)}
                                    selected={zone === tz}
                                    onSelect={() => { setTz(zone); setPicking(false); setMessage(null); }}
                                    testID={`tz-${zone}`}
                                />
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </Section>
    );
}

const styles = StyleSheet.create({
    block: { gap: space.md },
    hint: { ...typeScale.caption, color: colors.text.secondary },
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay },
    sheet: {
        maxHeight: '75%',
        backgroundColor: colors.surface.page,
        borderTopLeftRadius: radii.xxl,
        borderTopRightRadius: radii.xxl,
        paddingTop: space.sm,
        paddingHorizontal: layout.gutter,
        paddingBottom: space.xxl,
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    sheetTitle: { ...typeScale.headline, color: colors.text.primary },
    sheetList: { paddingBottom: space.lg },
    close: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: colors.interactive.pressedOpacity },
});
