import { useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Button from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import {
  getMobileApiUrl,
  handleDeepLinkAuth,
  tryRestorePendingSession,
} from '../../navigation/useRootNavigationSession';
import AuthHeroBadge from './components/AuthHeroBadge';
import { useAuthAppStateRecovery } from './hooks/useAuthAppStateRecovery';
import { type AuthUiState, isBusyAuthState } from './hooks/authUiState';
import { useGoogleSignInFlow } from './hooks/useGoogleSignInFlow';
import { useTelegramSignInFlow } from './hooks/useTelegramSignInFlow';
import { useWhatsAppSignInFlow } from './hooks/useWhatsAppSignInFlow';
import { authSignInStyles as styles } from './styles/authSignInStyles';

const TELEGRAM_STATUS_LABEL: Record<AuthUiState, string | null> = {
  idle: null,
  loading: 'Запускаем вход через Telegram...',
  pending: 'Ожидаем подтверждение',
  success: 'Подтверждено',
  error: 'Ошибка входа через Telegram',
  cancel: 'Вход через Telegram отменен',
  expired: 'Срок подтверждения истек',
};

export default function SignInScreen() {
  const { showToast } = useToast();
  const apiUrl = getMobileApiUrl();

  const ensureSessionRestored = async (callbackUrl?: string, attempts = 4) => {
    if (callbackUrl) {
      await handleDeepLinkAuth(callbackUrl, apiUrl);
    }

    for (let i = 0; i < attempts; i += 1) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        return true;
      }

      const restored = await tryRestorePendingSession(apiUrl).catch(() => false);
      if (restored) {
        const {
          data: { session: restoredSession },
        } = await supabase.auth.getSession();
        if (restoredSession) {
          return true;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    return false;
  };

  const { googleLoading, googleState, handleGoogleSignIn, recoverGoogleOnAppActive } =
    useGoogleSignInFlow({
      apiUrl,
      showToast,
    });

  const {
    telegramLoading,
    telegramState,
    telegramNonce,
    startTelegramMobileLogin,
    openTelegramAgain,
    cancelTelegramLogin,
    recoverTelegramOnAppActive,
    telegramDeeplinkEnabled,
  } = useTelegramSignInFlow({
    apiUrl,
    showToast,
    ensureSessionRestored,
  });

  const { whatsAppMobileAuthEnabled, openWhatsAppSignIn } = useWhatsAppSignInFlow();

  useAuthAppStateRecovery({
    onAppActive: useCallback(async () => {
      await recoverGoogleOnAppActive();
      await recoverTelegramOnAppActive();
    }, [recoverGoogleOnAppActive, recoverTelegramOnAppActive]),
  });

  const anyBusyAuth = isBusyAuthState(googleState) || isBusyAuthState(telegramState);
  const telegramStatusLabel = TELEGRAM_STATUS_LABEL[telegramState];
  const hasTelegramStateCard = telegramState !== 'idle' && (Boolean(telegramStatusLabel) || Boolean(telegramNonce));

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={[
          colors.background.gradient.from,
          colors.background.gradient.via,
          colors.background.gradient.to,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pageGradient}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.header}>
              <AuthHeroBadge />
              <Text style={styles.title}>Вход в Kezek</Text>
              <Text style={styles.subtitle}>Быстрый вход без пароля</Text>
              <Text style={styles.helper}>
                Выберите удобный способ авторизации. Мы восстановим сессию автоматически после
                подтверждения.
              </Text>
            </View>

            <View style={styles.methodsSection}>
              <View style={styles.methodsCaptionWrap}>
                <View style={styles.methodsCaptionLine} />
                <Text style={styles.methodsCaptionText}>Быстрые способы входа</Text>
                <View style={styles.methodsCaptionLine} />
              </View>

              <View style={styles.methodsButtons}>
                <Button
                  title="Продолжить с Google"
                  onPress={() => void handleGoogleSignIn()}
                  loading={googleLoading}
                  disabled={anyBusyAuth}
                  variant="authNeutral"
                  style={styles.googleButton}
                  accessibilityHint="Открывает авторизацию Google."
                  fullWidth
                />

                <Button
                  title="Войти через Telegram"
                  onPress={() => void startTelegramMobileLogin()}
                  loading={telegramLoading}
                  disabled={anyBusyAuth || !telegramDeeplinkEnabled}
                  variant="authTelegram"
                  style={styles.telegramButton}
                  accessibilityHint="Открывает Telegram для подтверждения входа."
                  fullWidth
                />

                {hasTelegramStateCard && (
                  <View style={styles.telegramStateCard}>
                    {telegramStatusLabel && (
                      <Text accessibilityLiveRegion="polite" style={styles.telegramStatusText}>
                        {telegramStatusLabel}
                      </Text>
                    )}
                    {telegramNonce && (
                      <View style={styles.telegramFlowActions}>
                        <Button
                          title="Открыть Telegram снова"
                          onPress={() => void openTelegramAgain()}
                          variant="outline"
                          style={styles.telegramActionButton}
                          accessibilityHint="Повторно открывает Telegram для подтверждения входа."
                          fullWidth
                        />
                        <Button
                          title="Отменить вход"
                          onPress={cancelTelegramLogin}
                          variant="ghost"
                          style={styles.telegramActionButton}
                          accessibilityHint="Прерывает текущую попытку входа через Telegram."
                          fullWidth
                        />
                      </View>
                    )}
                  </View>
                )}

                {whatsAppMobileAuthEnabled && (
                  <Button
                    title="Войти через WhatsApp"
                    onPress={openWhatsAppSignIn}
                    disabled={anyBusyAuth}
                    variant="authWhatsApp"
                    style={styles.whatsAppButton}
                    accessibilityHint="Переход к экрану входа по коду из WhatsApp."
                    fullWidth
                  />
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}
