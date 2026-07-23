'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

type TelegramAccountSwitchHelpProps = {
    context: 'login' | 'link';
    onRefresh: () => void;
};

export function TelegramAccountSwitchHelp({
    context,
    onRefresh,
}: TelegramAccountSwitchHelpProps) {
    const [expanded, setExpanded] = useState(false);
    const helpId = useId();
    const actionLabel =
        context === 'login'
            ? 'Войти с другого Telegram-аккаунта'
            : 'Подключить другой Telegram-аккаунт';

    useEffect(() => {
        if (!expanded) return;

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setExpanded(false);
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [expanded]);

    return (
        <div className="mt-2 text-center">
            <button
                type="button"
                className="text-xs font-medium text-[var(--accent-primary)] underline-offset-4 hover:underline"
                aria-expanded={expanded}
                aria-controls={helpId}
                onClick={() => setExpanded((current) => !current)}
            >
                {actionLabel}
            </button>

            {expanded
                ? createPortal(
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                          <button
                              type="button"
                              aria-label="Закрыть подсказку"
                              className="absolute inset-0 cursor-default bg-slate-950/65 backdrop-blur-sm"
                              onClick={() => setExpanded(false)}
                          />
                          <div
                              id={helpId}
                              role="dialog"
                              aria-modal="true"
                              aria-labelledby={`${helpId}-title`}
                              className="relative w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 text-left shadow-2xl"
                          >
                              <button
                                  type="button"
                                  aria-label="Закрыть"
                                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]"
                                  onClick={() => setExpanded(false)}
                              >
                                  ×
                              </button>
                              <p
                                  id={`${helpId}-title`}
                                  className="pr-8 text-base font-semibold text-[var(--text-primary)]"
                              >
                                  Telegram запомнил аккаунт в браузере
                              </p>
                              <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                                  <li>Откройте управление входом Telegram.</li>
                                  <li>Нажмите текущий профиль и выберите Log out.</li>
                                  <li>Вернитесь сюда и обновите кнопку — Telegram предложит другой номер.</li>
                              </ol>
                              <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                                  В приложении: Настройки → Конфиденциальность → Боты и сайты.
                              </p>
                              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                  <a
                                      href="https://core.telegram.org/widgets/login-legacy"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[var(--radius-md)] bg-[#229ED9] px-3 text-sm font-semibold text-white transition hover:bg-[#168ac2]"
                                  >
                                      Открыть Telegram
                                  </a>
                                  <button
                                      type="button"
                                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-emphasis)]"
                                      onClick={() => {
                                          onRefresh();
                                          setExpanded(false);
                                      }}
                                  >
                                      Обновить кнопку
                                  </button>
                              </div>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
}
