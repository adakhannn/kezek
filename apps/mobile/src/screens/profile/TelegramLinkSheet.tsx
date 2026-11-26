import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { elevation, layout, radii, space, typeScale } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import { getApiErrorStatus, getErrorMessage } from '../../lib/errors';
import { telegramProfileLink } from './profileApi';
import {
    isTelegramAttemptExpired,
    isTelegramBotLink,
    telegramPollDelay,
    type TelegramLinkAttempt,
    type TelegramLinkState,
} from './profileConnections';

type Props = {
    visible: boolean;
    onClose: () => void;
    onLinked: () => void;
    /** The bot link is not switched on on the server (503): link on the website instead. */
    onUnavailable: () => void;
};

/**
 * Native Telegram linking, the website's TelegramBotLink: a one-time bot link, the user confirms in
 * Telegram, the app polls the status, shows the account and links it on the user's confirmation.
 */
export function TelegramLinkSheet({ visible, onClose, onLinked, onUnavailable }: Props) {
    const { t } = useLanguage();
    const [attempt, setAttempt] = useState<TelegramLinkAttempt | null>(null);
    const [state, setState] = useState<TelegramLinkState>({ status: 'pending' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pollFailed, setPollFailed] = useState(false);
    // Polling pauses in the background (the user is in Telegram) and resumes on return.
    const [appActive, setAppActive] = useState(AppState.currentState !== 'background');
    const busyRef = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        const subscription = AppState.addEventListener('change', (next) => setAppActive(next !== 'background'));
        return () => {
            mounted.current = false;
            subscription.remove();
        };
    }, []);

    const start = useCallback(async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setError(null);
        setPollFailed(false);
        try {
            // The previous link is invalidated before another account is asked for.
            if (attempt) await telegramProfileLink.cancel(attempt.token).catch(() => undefined);
            setAttempt(null);
            setState({ status: 'pending' });
            const next = await telegramProfileLink.create();
            if (!mounted.current) return;
            if (!isTelegramBotLink(next?.botDeepLink)) throw new Error(t('parity.telegramLink.createError'));
            setAttempt(next);
        } catch (createError) {
            if (!mounted.current) return;
            if (getApiErrorStatus(createError) === 503) {
                onUnavailable();
                return;
            }
            setError(getErrorMessage(createError, t('parity.telegramLink.createError'), t));
        } finally {
            busyRef.current = false;
            if (mounted.current) setBusy(false);
        }
    }, [attempt, onUnavailable, t]);

    // A new link each time the sheet opens.
    useEffect(() => {
        if (visible && !attempt && !busyRef.current) void start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    useEffect(() => {
        if (!visible || !attempt || state.status !== 'pending' || !appActive) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let failures = 0;
        const poll = async () => {
            if (controller.signal.aborted) return;
            if (isTelegramAttemptExpired(attempt)) {
                setState({ status: 'expired' });
                return;
            }
            try {
                const result = await telegramProfileLink.status(attempt.token, controller.signal);
                if (controller.signal.aborted) return;
                failures = 0;
                setPollFailed(false);
                setState(result ?? { status: 'pending' });
                if (result && result.status !== 'pending') return;
            } catch {
                if (controller.signal.aborted) return;
                failures += 1;
                setPollFailed(true);
            }
            timer = setTimeout(() => void poll(), telegramPollDelay(failures));
        };
        void poll();
        return () => {
            controller.abort();
            if (timer) clearTimeout(timer);
        };
    }, [visible, attempt, state.status, appActive]);

    const close = () => {
        if (busyRef.current) return;
        if (attempt && state.status !== 'consumed') void telegramProfileLink.cancel(attempt.token).catch(() => undefined);
        setAttempt(null);
        setState({ status: 'pending' });
        setError(null);
        onClose();
    };

    const finish = async () => {
        if (!attempt || !state.account || busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setError(null);
        try {
            await telegramProfileLink.finish(attempt.token, state.account.id);
            if (!mounted.current) return;
            setAttempt(null);
            setState({ status: 'pending' });
            onLinked();
        } catch (finishError) {
            if (mounted.current) setError(getErrorMessage(finishError, t('parity.telegramLink.connectError'), t));
        } finally {
            busyRef.current = false;
            if (mounted.current) setBusy(false);
        }
    };

    const openBot = async () => {
        if (!attempt) return;
        try {
            await Linking.openURL(attempt.botDeepLink);
        } catch {
            setError(t('parity.telegramLink.openBotError'));
        }
    };

    const ended = state.status === 'expired' || state.status === 'cancelled';

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
            <View style={styles.backdrop}>
                <View style={styles.sheet} testID="telegram-link-sheet" accessibilityViewIsModal>
                    <View style={styles.grabber} />
                    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                        <Text style={styles.title} accessibilityRole="header">{t('parity.telegramLink.title')}</Text>
                        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

                        {!attempt && !ended ? (
                            <Text style={styles.hint}>
                                {busy ? t('parity.telegramLink.preparing') : t('parity.telegramLink.createPrompt')}
                            </Text>
                        ) : null}

                        {attempt && state.status === 'pending' ? (
                            <>
                                <View style={styles.steps}>
                                    {(['parity.telegramLink.step1', 'parity.telegramLink.step2', 'parity.telegramLink.step3'] as const).map((key, index) => (
                                        <View key={key} style={styles.stepRow}>
                                            <View style={styles.stepNumber}>
                                                <Text style={styles.stepNumberText}>{index + 1}</Text>
                                            </View>
                                            <Text style={styles.step}>{t(key)}</Text>
                                        </View>
                                    ))}
                                </View>
                                <Button
                                    title={t('parity.telegramLink.openBot')}
                                    onPress={() => void openBot()}
                                    variant="authTelegram"
                                    fullWidth
                                />
                                <Text style={styles.hint} accessibilityLiveRegion="polite">
                                    {pollFailed ? t('parity.telegramLink.pollError') : t('parity.telegramLink.waiting')}
                                </Text>
                                <Text style={styles.caption}>{t('parity.telegramLink.doNotShare')}</Text>
                            </>
                        ) : null}

                        {state.status === 'approved' && state.account ? (
                            <>
                                <Text style={styles.hint}>{t('parity.telegramLink.checkAccount')}</Text>
                                <View style={styles.account}>
                                    <Text style={styles.accountName}>{state.account.name || t('parity.telegramLink.accountFallback')}</Text>
                                    {state.account.username ? <Text style={styles.hint}>@{state.account.username}</Text> : null}
                                    <Text style={styles.caption}>ID: {state.account.id}</Text>
                                </View>
                                <Button
                                    title={t('parity.telegramLink.finish')}
                                    onPress={() => void finish()}
                                    loading={busy}
                                    disabled={busy}
                                    fullWidth
                                />
                            </>
                        ) : null}

                        {ended ? (
                            <Text style={styles.hint} accessibilityLiveRegion="polite">
                                {t(state.status === 'expired' ? 'parity.telegramLink.expired' : 'parity.telegramLink.cancelled')}
                            </Text>
                        ) : null}

                        {!busy ? (
                            <Button
                                title={attempt && (state.status === 'pending' || state.status === 'approved')
                                    ? t('parity.telegramLink.newLinkOtherAccount')
                                    : t('parity.telegramLink.newLink')}
                                onPress={() => void start()}
                                variant="ghost"
                                fullWidth
                            />
                        ) : null}
                        <Text style={styles.caption}>{t('parity.telegramLink.profileKept')}</Text>
                        <Button title={t('cabinet.ui.cancel')} onPress={close} variant="outline" fullWidth disabled={busy} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay },
    sheet: {
        maxHeight: '85%',
        backgroundColor: colors.surface.card,
        borderTopLeftRadius: radii.xxl,
        borderTopRightRadius: radii.xxl,
        paddingTop: space.sm,
        ...elevation.floating,
    },
    grabber: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: radii.pill,
        backgroundColor: colors.border.strong,
    },
    content: { paddingHorizontal: layout.gutter, paddingTop: space.lg, paddingBottom: space.xxl, gap: space.md },
    title: { ...typeScale.title, color: colors.text.primary },
    hint: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary },
    steps: { gap: space.md },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.info.bg,
    },
    stepNumberText: { ...typeScale.caption, fontWeight: '700', color: colors.tone.info.fg },
    step: { ...typeScale.body, color: colors.text.primary, flex: 1 },
    caption: { ...typeScale.caption, color: colors.text.tertiary },
    error: { ...typeScale.callout, fontWeight: '400', color: colors.tone.danger.fg },
    account: {
        borderRadius: radii.md,
        backgroundColor: colors.surface.elevated,
        padding: space.lg,
        gap: space.xxs,
    },
    accountName: { ...typeScale.headline, color: colors.text.primary },
});
