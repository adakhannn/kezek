import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { logEnvVars } from '../utils/debug';
import { logError, logDebug } from './log';

// В Expo переменные окружения доступны через process.env.EXPO_PUBLIC_*
// Также можно получить через Constants.expoConfig.extra (если настроено в app.json)
// Приоритет: process.env > Constants.expoConfig.extra > Constants.manifest.extra
const supabaseUrl = 
    process.env.EXPO_PUBLIC_SUPABASE_URL || 
    Constants.expoConfig?.extra?.supabaseUrl ||
    Constants.manifest?.extra?.supabaseUrl;
const supabaseAnonKey = 
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
    Constants.expoConfig?.extra?.supabaseAnonKey ||
    Constants.manifest?.extra?.supabaseAnonKey;

// Детальное логирование для отладки
logEnvVars();
logDebug('Supabase', 'Initialization', {
    supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET',
    supabaseAnonKey: supabaseAnonKey ? 'SET' : 'NOT SET',
    source: {
        url: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'process.env' : (Constants.expoConfig?.extra?.supabaseUrl ? 'app.json' : 'NOT FOUND'),
        key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'process.env' : (Constants.expoConfig?.extra?.supabaseAnonKey ? 'app.json' : 'NOT FOUND'),
    },
});

if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = `Missing Supabase environment variables. 
    
Please create apps/mobile/.env.local with:
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_API_URL=https://kezek.kg

Then restart Expo with: npx expo start --clear`;

    logError('Supabase', 'Initialization error', { message: errorMsg });
    throw new Error(errorMsg);
}

// Custom storage для React Native (использует SecureStore)
const storage = {
    getItem: async (key: string) => {
        return await SecureStore.getItemAsync(key);
    },
    setItem: async (key: string, value: string) => {
        await SecureStore.setItemAsync(key, value);
    },
    removeItem: async (key: string) => {
        await SecureStore.deleteItemAsync(key);
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

