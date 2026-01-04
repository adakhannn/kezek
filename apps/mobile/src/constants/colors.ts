/**
 * Цветовая палитра мобильного приложения
 * Соответствует дизайну веб-версии (темная тема)
 */

export const colors = {
    // Основные цвета
    primary: {
        from: '#4f46e5', // indigo-600
        to: '#db2777', // pink-600
        hoverFrom: '#4338ca', // indigo-700
        hoverTo: '#be185d', // pink-700
    },
    
    // Фоны (темная тема)
    background: {
        primary: '#030712', // gray-950 (основной фон)
        secondary: '#111827', // gray-900 (карточки, элементы)
        tertiary: '#1f2937', // gray-800
        dark: '#111827', // gray-900
        darkSecondary: '#1f2937', // gray-800
        gradient: {
            from: '#030712', // gray-950
            via: '#111827', // gray-900
            to: 'rgba(30, 27, 75, 0.3)', // indigo-950/30
        },
    },
    
    // Текст (темная тема)
    text: {
        primary: '#f3f4f6', // gray-100
        secondary: '#9ca3af', // gray-400
        tertiary: '#6b7280', // gray-500
        light: '#ffffff',
        dark: '#111827',
    },
    
    // Границы (темная тема)
    border: {
        light: '#374151', // gray-700
        dark: '#1f2937', // gray-800
    },
    
    // Статусы
    status: {
        confirmed: '#10b981', // green-500
        pending: '#f59e0b', // amber-500
        cancelled: '#ef4444', // red-500
        hold: '#f59e0b', // amber-500
    },
    
    // Акценты
    accent: {
        indigo: '#6366f1', // indigo-500
        pink: '#ec4899', // pink-500
    },
    
    // Тени
    shadow: {
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 5,
        },
    },
};

