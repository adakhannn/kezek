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
const SECURE_STORE_CHUNK_SIZE = 1800;
const SECURE_STORE_META_SUFFIX = '__chunks_meta';
const SECURE_STORE_CHUNK_SUFFIX = '__chunk_';

function getMetaKey(key: string) {
    return `${key}${SECURE_STORE_META_SUFFIX}`;
}

function getChunkKey(key: string, index: number) {
    return `${key}${SECURE_STORE_CHUNK_SUFFIX}${index}`;
}

const storage = {
    getItem: async (key: string) => {
        const metaRaw = await SecureStore.getItemAsync(getMetaKey(key));
        if (metaRaw) {
            const chunkCount = Number(metaRaw);
            if (Number.isInteger(chunkCount) && chunkCount > 0) {
                const parts: string[] = [];
                for (let i = 0; i < chunkCount; i += 1) {
                    const chunk = await SecureStore.getItemAsync(getChunkKey(key, i));
                    if (chunk == null) {
                        return null;
                    }
                    parts.push(chunk);
                }

                return parts.join('');
            }
        }

        return await SecureStore.getItemAsync(key);
    },
    setItem: async (key: string, value: string) => {
        if (value.length <= SECURE_STORE_CHUNK_SIZE) {
            await SecureStore.setItemAsync(key, value);
            const staleMeta = await SecureStore.getItemAsync(getMetaKey(key));
            const staleCount = Number(staleMeta || 0);
            if (Number.isInteger(staleCount) && staleCount > 0) {
                for (let i = 0; i < staleCount; i += 1) {
                    await SecureStore.deleteItemAsync(getChunkKey(key, i));
                }
                await SecureStore.deleteItemAsync(getMetaKey(key));
            }
            return;
        }

        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += SECURE_STORE_CHUNK_SIZE) {
            chunks.push(value.slice(i, i + SECURE_STORE_CHUNK_SIZE));
        }

        for (let i = 0; i < chunks.length; i += 1) {
            await SecureStore.setItemAsync(getChunkKey(key, i), chunks[i]);
        }
        await SecureStore.setItemAsync(getMetaKey(key), String(chunks.length));
        await SecureStore.deleteItemAsync(key);
    },
    removeItem: async (key: string) => {
        const metaRaw = await SecureStore.getItemAsync(getMetaKey(key));
        const chunkCount = Number(metaRaw || 0);
        if (Number.isInteger(chunkCount) && chunkCount > 0) {
            for (let i = 0; i < chunkCount; i += 1) {
                await SecureStore.deleteItemAsync(getChunkKey(key, i));
            }
            await SecureStore.deleteItemAsync(getMetaKey(key));
        }
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

