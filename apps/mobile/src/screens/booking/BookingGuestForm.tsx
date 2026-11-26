import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import FormField from '../../components/ui/FormField';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import { space, typeScale } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import type { GuestContacts } from './bookingSelection';

type BookingGuestFormProps = {
    contacts: GuestContacts;
    onChange: (next: Partial<GuestContacts>) => void;
    error: string | null;
    /** Submitted from the keyboard; the step's bottom bar carries the "Записаться как гость" button. */
    onSubmit: () => void;
    onSignIn: () => void;
    submitting: boolean;
    /** The bottom bar's button state; kept for callers. */
    disabled?: boolean;
};

/**
 * Booking without an account (C1, web AuthChoiceModal + GuestBookingModal): name and phone are
 * required, email is optional; signing in instead keeps the chosen booking.
 */
export default function BookingGuestForm({
    contacts,
    onChange,
    error,
    onSubmit,
    onSignIn,
    submitting,
}: BookingGuestFormProps) {
    const { t } = useLanguage();
    const phoneRef = useRef<TextInput>(null);
    const emailRef = useRef<TextInput>(null);

    return (
        <>
            <Section title={t('booking.guest.title')} caption={t('booking.guest.info')}>
                <Card variant="plain" padding="md" style={styles.card}>
                    <FormField
                        label={t('booking.guest.name')}
                        required
                        value={contacts.name}
                        onChangeText={(name) => onChange({ name })}
                        placeholder={t('booking.guest.namePlaceholder')}
                        autoComplete="name"
                        textContentType="name"
                        returnKeyType="next"
                        onSubmitEditing={() => phoneRef.current?.focus()}
                        editable={!submitting}
                    />
                    <FormField
                        ref={phoneRef}
                        label={t('booking.guest.phone')}
                        required
                        value={contacts.phone}
                        onChangeText={(phone) => onChange({ phone })}
                        placeholder={t('booking.guest.phonePlaceholder')}
                        hint={t('booking.guest.phoneHelper')}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                        returnKeyType="next"
                        onSubmitEditing={() => emailRef.current?.focus()}
                        editable={!submitting}
                    />
                    <FormField
                        ref={emailRef}
                        label={t('booking.guest.emailOptional')}
                        value={contacts.email}
                        onChangeText={(email) => onChange({ email })}
                        placeholder={t('booking.guest.emailPlaceholder')}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        textContentType="emailAddress"
                        returnKeyType="done"
                        onSubmitEditing={onSubmit}
                        editable={!submitting}
                    />

                    {error ? (
                        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
                            {error}
                        </Text>
                    ) : null}
                </Card>
            </Section>

            <View style={styles.signIn}>
                <Text style={styles.signInHint}>{t('booking.guest.signInHint')}</Text>
                <Button
                    title={t('booking.guest.signIn')}
                    onPress={onSignIn}
                    disabled={submitting}
                    variant="outline"
                    fullWidth
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    card: { paddingBottom: space.xs },
    error: { ...typeScale.callout, fontWeight: '400', color: colors.tone.danger.fg, marginBottom: space.md },
    signIn: { gap: space.sm },
    signInHint: { ...typeScale.caption, color: colors.text.secondary },
});
