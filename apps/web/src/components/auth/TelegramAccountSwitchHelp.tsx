'use client';

import { useId, useState } from 'react';

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

            {expanded ? (
                <div
                    id={helpId}
                    className="mx-auto mt-3 max-w-sm rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-3 text-left"
                >
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Telegram запомнил аккаунт в браузере
                    </p>
                    <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-[var(--text-secondary)]">
                        <li>Откройте управление входом Telegram.</li>
                        <li>Нажмите текущий профиль и выберите Log out.</li>
                        <li>Вернитесь сюда и обновите кнопку — Telegram предложит другой номер.</li>
                    </ol>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                        В приложении: Настройки → Конфиденциальность → Боты и сайты.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <a
                            href="https://core.telegram.org/widgets/login-legacy"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-md)] bg-[#229ED9] px-3 text-xs font-semibold text-white transition hover:bg-[#168ac2]"
                        >
                            Открыть Telegram
                        </a>
                        <button
                            type="button"
                            className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-card)]"
                            onClick={() => {
                                onRefresh();
                                setExpanded(false);
                            }}
                        >
                            Обновить кнопку
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
