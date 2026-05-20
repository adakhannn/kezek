'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import {
  exchangeWhatsAppWebSession,
  startWhatsAppWebAuth,
  verifyWhatsAppWebOtp,
  type VerifyResponseData,
} from './whatsAppWebAuthClient';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { supabase } from '@/lib/supabaseClient';

type Step = 'phone' | 'otp';

function WhatsAppAuthContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get('redirect') || '/';

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [maskedDestination, setMaskedDestination] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setSending(true);
    setError(null);

    try {
      const payload = await startWhatsAppWebAuth(fetch, phone);
      setAttemptId(payload.attemptId);
      setMaskedDestination(payload.maskedDestination ?? null);
      setStep('otp');
      setCountdown(60);
      setOtp('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);

    try {
      if (!attemptId) {
        throw new Error('Сессия подтверждения не найдена. Запросите код заново.');
      }
      if (otp.trim().length !== 6) {
        throw new Error('Введите 6-значный код.');
      }

      const payload: VerifyResponseData = await verifyWhatsAppWebOtp(fetch, {
        attemptId,
        phone,
        code: otp,
      });
      if (payload.status !== 'approved' || !payload.exchangeCode) {
        throw new Error('Проверка не завершена. Попробуйте снова.');
      }
      const exchangeData = await exchangeWhatsAppWebSession(fetch, payload.exchangeCode);

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: exchangeData.accessToken,
        refresh_token: exchangeData.refreshToken,
      });
      if (sessionError) {
        throw new Error(`Не удалось установить сессию: ${sessionError.message}`);
      }

      router.refresh();
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setVerifying(false);
    }
  }

  async function handleResendOtp() {
    if (countdown > 0 || sending) return;
    await handleSendOtp();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Вход через WhatsApp
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {step === 'phone'
              ? 'Введите номер телефона, на него придет код в WhatsApp.'
              : 'Введите код, который пришел вам в WhatsApp.'}
          </p>
        </div>

        {error ? <AlertBanner variant="danger" message={error} compact /> : null}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="mt-8 space-y-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Номер телефона
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+996500574029"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={sending}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Отправка...' : 'Отправить код'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mt-8 space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Код подтверждения
              </label>
              <input
                id="otp"
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-700 text-center text-2xl tracking-widest"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Код отправлен на {maskedDestination || phone}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setAttemptId(null);
                  setMaskedDestination(null);
                }}
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                Изменить номер
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={countdown > 0 || sending}
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {countdown > 0 ? `Отправить снова (${countdown}с)` : 'Отправить код снова'}
              </button>
            </div>

            <div>
              <button
                type="submit"
                disabled={verifying || otp.length !== 6}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifying ? 'Проверка...' : 'Войти'}
              </button>
            </div>
          </form>
        )}

        <div className="text-center">
          <button
            onClick={() => router.push('/auth/sign-in')}
            className="text-sm text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Вернуться к другим способам входа
          </button>
        </div>
      </div>
    </main>
  );
}

export default function WhatsAppAuthPage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Загрузка...</p>
              </div>
            </div>
          </main>
        }
      >
        <WhatsAppAuthContent />
      </Suspense>
    </ErrorBoundary>
  );
}
