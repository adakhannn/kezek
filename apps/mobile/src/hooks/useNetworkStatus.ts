import { useNetworkState } from 'expo-network';

/**
 * Контракт статуса сети для единообразной обработки офлайна в экранах.
 * - isOffline: нет активного подключения (основной флаг для баннеров и блокировок).
 * - isPoorConnection: нестабильная/медленная сеть (опционально, для будущего использования).
 */
export type NetworkStatus = {
    isConnected: boolean;
    isInternetReachable: boolean;
    /** true, когда нет активного подключения к сети */
    isOffline: boolean;
    /** true, когда сеть есть, но качество низкое (пока не реализовано, всегда false) */
    isPoorConnection?: boolean;
};

/**
 * Хук для отслеживания статуса сети (expo-network).
 * Подписывается на изменения и возвращает актуальное состояние подключения.
 */
export function useNetworkStatus(): NetworkStatus {
    const networkState = useNetworkState();
    const isConnected = networkState?.isConnected ?? false;
    const isInternetReachable = networkState?.isInternetReachable ?? false;
    const isOffline = !isConnected || !isInternetReachable;

    return {
        isConnected,
        isInternetReachable,
        isOffline,
        isPoorConnection: false, // expo-network не даёт качества связи; при необходимости подключить NetInfo
    };
}

