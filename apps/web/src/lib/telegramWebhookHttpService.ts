import { NextRequest, NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { writeTelegramAuthAuditEvent } from '@/lib/telegramAuthAuditLogService';
import {
    answerTelegramCallbackQuery,
    editTelegramBotMessageText,
    sendTelegramBotMessage,
    type TelegramReplyMarkup,
} from '@/lib/telegramBotApiService';
import {
    attachTelegramMobileAuthAttemptTelegramContext,
    getTelegramMobileAuthAttempt,
} from '@/lib/telegramMobileAuthAttemptService';
import { runTelegramMobileCallbackRoute } from '@/lib/telegramMobileCallbackRouteService';
import { parseTelegramMobileStartPayload } from '@/lib/telegramMobileDeepLinkPayload';

type TelegramUser = {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
};

type TelegramMessage = {
    message_id: number;
    text?: string;
    chat?: {
        id: number;
    };
    from?: TelegramUser;
};

type TelegramCallbackQuery = {
    id: string;
    data?: string;
    from?: TelegramUser;
    message?: TelegramMessage;
};

type TelegramUpdate = {
    update_id?: number;
    message?: TelegramMessage;
    callback_query?: TelegramCallbackQuery;
};

const CALLBACK_PREFIX = 'km1c';

function getTimezone() {
    const raw = process.env.NEXT_PUBLIC_TZ?.trim();
    return raw || 'Asia/Bishkek';
}

function formatAttemptTime(timestampMs: number) {
    return new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: getTimezone(),
    }).format(new Date(timestampMs));
}

function buildSourceText(params: {
    appName?: string | null;
    createdAt: number;
    region?: string | null;
    device?: string | null;
    platform?: string | null;
}) {
    const platformWithDevice = [params.device, params.platform].filter(Boolean).join(' / ');
    const regionText = params.region || 'не указан';
    const deviceText = platformWithDevice || 'не указано';

    return [
        'Подтвердите вход в Kezek',
        '',
        'Источник входа:',
        `- Приложение: ${params.appName || 'Kezek Mobile'}`,
        `- Время: ${formatAttemptTime(params.createdAt)}`,
        `- Регион: ${regionText}`,
        `- Устройство: ${deviceText}`,
        '',
        'Если это не вы, нажмите "Отменить".',
    ].join('\n');
}

function buildConfirmationKeyboard(nonce: string): TelegramReplyMarkup {
    return {
        inline_keyboard: [
            [
                {
                    text: 'Подтвердить вход',
                    callback_data: `${CALLBACK_PREFIX}:ok:${nonce}`,
                },
            ],
            [
                {
                    text: 'Отменить',
                    callback_data: `${CALLBACK_PREFIX}:cancel:${nonce}`,
                },
            ],
        ],
    };
}

function parseConfirmCallbackData(data: string): {
    decision: 'ok' | 'cancel';
    nonce: string;
} | null {
    const normalized = data.trim();
    const match = normalized.match(/^km1c:(ok|cancel):([A-Za-z0-9_-]{20,128})$/);
    if (!match) {
        return null;
    }

    return {
        decision: match[1] as 'ok' | 'cancel',
        nonce: match[2],
    };
}

async function handleTelegramStartCommand(message: TelegramMessage) {
    const chatId = message.chat?.id;
    const from = message.from;
    const text = message.text?.trim() || '';
    if (!chatId || !from) {
        return;
    }

    const [, payload] = text.split(/\s+/, 2);
    if (!payload) {
        await sendTelegramBotMessage({
            chatId,
            text: 'Откройте вход через Telegram в приложении Kezek и перейдите по новой ссылке.',
        });
        return;
    }

    const parsed = parseTelegramMobileStartPayload(payload);
    if (!parsed) {
        await sendTelegramBotMessage({
            chatId,
            text: 'Ссылка входа недействительна. Запросите новый вход в приложении.',
        });
        return;
    }

    const attempt = getTelegramMobileAuthAttempt(parsed.nonce);
    if (!attempt) {
        await sendTelegramBotMessage({
            chatId,
            text: 'Попытка входа не найдена. Запросите новый вход в приложении.',
        });
        return;
    }

    if (attempt.status !== 'pending') {
        const statusText =
            attempt.status === 'approved'
                ? 'Этот вход уже подтвержден.'
                : attempt.status === 'expired'
                    ? 'Срок действия входа истек. Запросите новый вход в приложении.'
                    : 'Этот вход уже отменен.';
        await sendTelegramBotMessage({
            chatId,
            text: statusText,
        });
        return;
    }

    const bindResult = attachTelegramMobileAuthAttemptTelegramContext({
        nonce: parsed.nonce,
        telegramId: from.id,
        chatId,
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
    });

    if (!bindResult.ok) {
        const bindErrorText =
            bindResult.error === 'already_bound_other_telegram'
                ? 'Этот вход уже открыт в другом Telegram аккаунте.'
                : 'Не удалось подтвердить этот вход. Запросите новый вход в приложении.';
        await sendTelegramBotMessage({
            chatId,
            text: bindErrorText,
        });
        return;
    }

    await sendTelegramBotMessage({
        chatId,
        text: buildSourceText({
            appName: bindResult.attempt.source?.appName,
            createdAt: bindResult.attempt.createdAt,
            region: bindResult.attempt.source?.region,
            device: bindResult.attempt.source?.device,
            platform: bindResult.attempt.source?.platform,
        }),
        replyMarkup: buildConfirmationKeyboard(parsed.nonce),
    });

    await writeTelegramAuthAuditEvent({
        eventType: 'bot_start_opened',
        nonce: parsed.nonce,
        telegramId: from.id,
        status: 'pending',
        metadata: {
            chatId,
            username: from.username ?? null,
        },
    });
}

async function handleTelegramConfirmCallback(callback: TelegramCallbackQuery) {
    if (!callback.id) {
        return;
    }

    const parsed = callback.data ? parseConfirmCallbackData(callback.data) : null;
    if (!parsed) {
        await answerTelegramCallbackQuery({
            callbackQueryId: callback.id,
            text: 'Некорректная команда',
            showAlert: true,
        });
        return;
    }

    const from = callback.from;
    const message = callback.message;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;

    if (!from || !chatId || !messageId) {
        await answerTelegramCallbackQuery({
            callbackQueryId: callback.id,
            text: 'Не удалось обработать запрос',
            showAlert: true,
        });
        return;
    }

    await answerTelegramCallbackQuery({
        callbackQueryId: callback.id,
        text: parsed.decision === 'cancel' ? 'Отменяем вход...' : 'Подтверждаем вход...',
    });

    const decision = parsed.decision === 'cancel' ? 'cancel' : 'approve';
    await writeTelegramAuthAuditEvent({
        eventType: 'bot_decision_received',
        nonce: parsed.nonce,
        telegramId: from.id,
        decision,
        status: 'pending',
        metadata: {
            callbackQueryId: callback.id,
        },
    });

    const decisionResult = await runTelegramMobileCallbackRoute({
        body: {
            nonce: parsed.nonce,
            telegram_id: from.id,
            decision,
            first_name: from.first_name,
            last_name: from.last_name,
            username: from.username,
        },
        botSecret: process.env.TELEGRAM_MOBILE_BOT_SECRET || null,
    });

    if (!decisionResult.ok) {
        const errorText =
            decisionResult.status === 410
                ? 'Срок действия входа истек. Запросите новый вход в приложении.'
                : decisionResult.status === 409
                    ? 'Этот вход уже обработан или подтверждается другим аккаунтом.'
                    : decisionResult.status === 404
                        ? 'Попытка входа не найдена.'
                        : parsed.decision === 'cancel'
                            ? 'Не удалось отменить вход. Попробуйте снова.'
                            : 'Не удалось подтвердить вход. Попробуйте снова из приложения.';

        await writeTelegramAuthAuditEvent({
            eventType: 'bot_login_failed',
            nonce: parsed.nonce,
            telegramId: from.id,
            decision,
            status: 'failed',
            reason: `decision_error_${decisionResult.status}`,
            metadata: {
                error: decisionResult.error,
                message: decisionResult.message,
            },
        });

        await editTelegramBotMessageText({
            chatId,
            messageId,
            text: errorText,
        });
        return;
    }

    await writeTelegramAuthAuditEvent({
        eventType:
            decision === 'cancel' ? 'bot_login_cancelled' : 'bot_login_approved',
        nonce: parsed.nonce,
        telegramId: from.id,
        decision,
        status: decisionResult.payload.status,
        linkage: decisionResult.payload.linkage ?? null,
    });

    await editTelegramBotMessageText({
        chatId,
        messageId,
        text: parsed.decision === 'cancel'
            ? 'Вход отменен. Если нужно, начните вход заново в приложении.'
            : 'Вход подтвержден. Вернитесь в приложение Kezek, авторизация завершится автоматически.',
    });
}

async function processTelegramWebhookUpdate(update: TelegramUpdate) {
    const messageText = update.message?.text?.trim();
    if (messageText?.startsWith('/start')) {
        await handleTelegramStartCommand(update.message);
        return;
    }

    if (update.callback_query) {
        await handleTelegramConfirmCallback(update.callback_query);
    }
}

function getExpectedWebhookSecret() {
    return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '';
}

export async function runTelegramWebhookPostHttp(
    request: NextRequest,
): Promise<NextResponse> {
    const expectedSecret = getExpectedWebhookSecret();
    if (expectedSecret) {
        const provided = request.headers.get('x-telegram-bot-api-secret-token') || '';
        if (provided !== expectedSecret) {
            return createErrorResponse('forbidden', 'Invalid telegram webhook secret', undefined, 403);
        }
    }

    const body = (await request.json()) as TelegramUpdate;
    await processTelegramWebhookUpdate(body);

    return createSuccessResponse(undefined, { success: true });
}
