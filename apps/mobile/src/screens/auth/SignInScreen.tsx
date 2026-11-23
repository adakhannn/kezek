import { useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Button from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { LanguageSwitcher, useLanguage, type MobileI18nKey } from '../../i18n';
import { supabase } from '../../lib/supabase';
import {
  getMobileApiUrl,
  handleDeepLinkAuth,
} from '../../navigation/useRootNavigationSession';
import AuthHeroBadge from './components/AuthHeroBadge';
import { useAuthAppStateRecovery } from './hooks/useAuthAppStateRecovery';
import { type AuthUiState, isBusyAuthState } from './hooks/authUiState';
import { useGoogleSignInFlow } from './hooks/useGoogleSignInFlow';
import { useTelegramSignInFlow } from './hooks/useTelegramSignInFlow';
import { useWhatsAppSignInFlow } from './hooks/useWhatsAppSignInFlow';
import { authSignInStyles as styles } from './styles/authSignInStyles';

const TELEGRAM_STATUS_LABEL: Record<AuthUiState, MobileI18nKey | null> = {
  idle: null,
  loading: 'auth.telegram.status.loading',
  pending: 'auth.telegram.status.pending',
  success: 'auth.telegram.status.success',
  error: 'auth.telegram.status.error',
  cancel: 'auth.telegram.status.cancel',
  expired: 'auth.telegram.status.expired',
};

const GOOGLE_STATUS_LABEL: Record<AuthUiState, MobileI18nKey | null> = {
  idle: null,
  loading: 'auth.google.status.loading',
  pending: 'auth.google.status.pending',
  success: 'auth.google.status.success',
  error: 'auth.google.status.error',
  cancel: 'auth.google.status.cancel',
  expired: 'auth.google.status.expired',
};

export default function SignInScreen() {
  const { showToast } = useToast();
  const { t } = useLanguage();
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
  const googleStatusKey = GOOGLE_STATUS_LABEL[googleState];
  const telegramStatusKey = TELEGRAM_STATUS_LABEL[telegramState];
  const googleStatusLabel = googleStatusKey ? t(googleStatusKey) : null;
  const telegramStatusLabel = telegramStatusKey ? t(telegramStatusKey) : null;
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
            {/* The language can be chosen before signing in (KG / RU / EN). */}
            <LanguageSwitcher style={styles.languageSwitcher} />
            <View style={styles.header}>
              <AuthHeroBadge />
              <Text style={styles.title}>{t('auth.signIn.title')}</Text>
              <Text style={styles.subtitle}>{t('auth.signIn.subtitle')}</Text>
              <Text style={styles.helper}>{t('auth.signIn.helper')}</Text>
            </View>

            <View style={styles.methodsSection}>
              {googleStatusLabel ? (
                <Text
                  accessibilityLiveRegion={googleState === 'error' ? 'assertive' : 'polite'}
                  accessibilityRole={googleState === 'error' ? 'alert' : 'text'}
                  style={styles.screenReaderStatus}
                >
                  {googleStatusLabel}
                </Text>
              ) : null}

              <View style={styles.methodsCaptionWrap}>
                <View style={styles.methodsCaptionLine} />
                <Text style={styles.methodsCaptionText}>{t('auth.signIn.methodsCaption')}</Text>
                <View style={styles.methodsCaptionLine} />
              </View>

              <View style={styles.methodsButtons}>
                <Button
                  title={t('auth.signIn.google')}
                  onPress={() => void handleGoogleSignIn()}
                  loading={googleLoading}
                  disabled={anyBusyAuth}
                  variant="authNeutral"
                  style={styles.googleButton}
                  accessibilityHint={t('auth.signIn.googleHint')}
                  fullWidth
                />

                <Button
                  title={t('auth.signIn.telegram')}
                  onPress={() => void startTelegramMobileLogin()}
                  loading={telegramLoading}
                  disabled={anyBusyAuth || !telegramDeeplinkEnabled}
                  variant="authTelegram"
                  style={styles.telegramButton}
                  accessibilityHint={t('auth.signIn.telegramHint')}
                  fullWidth
                />

                {hasTelegramStateCard && (
                  <View style={styles.telegramStateCard}>
                    {telegramStatusLabel && (
                      <Text
                        accessibilityLiveRegion={
                          telegramState === 'error' || telegramState === 'expired'
                            ? 'assertive'
                            : 'polite'
                        }
                        accessibilityRole={
                          telegramState === 'error' || telegramState === 'expired'
                            ? 'alert'
                            : 'text'
                        }
                        style={styles.telegramStatusText}
                      >
                        {telegramStatusLabel}
                      </Text>
                    )}
                    {telegramNonce && (
                      <View style={styles.telegramFlowActions}>
                        <Button
                          title={t('auth.signIn.telegramAgain')}
                          onPress={() => void openTelegramAgain()}
                          variant="outline"
                          style={styles.telegramActionButton}
                          accessibilityHint={t('auth.signIn.telegramAgainHint')}
                          fullWidth
                        />
                        <Button
                          title={t('auth.signIn.telegramCancel')}
                          onPress={cancelTelegramLogin}
                          variant="ghost"
                          style={styles.telegramActionButton}
                          accessibilityHint={t('auth.signIn.telegramCancelHint')}
                          fullWidth
                        />
                      </View>
                    )}
                  </View>
                )}

                {whatsAppMobileAuthEnabled && (
                  <Button
                    title={t('auth.signIn.whatsapp')}
                    onPress={openWhatsAppSignIn}
                    disabled={anyBusyAuth}
                    variant="authWhatsApp"
                    style={styles.whatsAppButton}
                    accessibilityHint={t('auth.signIn.whatsappHint')}
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
