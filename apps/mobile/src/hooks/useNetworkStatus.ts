/**
 * Хук для отслеживания статуса сети
 * TODO: Реализовать с использованием expo-network или встроенных API
 */
export function useNetworkStatus() {
    // Пока возвращаем всегда онлайн, так как для проверки сети нужна дополнительная настройка
    return {
        isConnected: true,
        isInternetReachable: true,
        isOffline: false,
    };
}

