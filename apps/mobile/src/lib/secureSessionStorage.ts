import * as SecureStore from 'expo-secure-store';

const SECURE_STORE_CHUNK_SIZE = 1800;
const SECURE_STORE_META_SUFFIX = '__chunks_meta';
const SECURE_STORE_CHUNK_SUFFIX = '__chunk_';

function getMetaKey(key: string) {
    return `${key}${SECURE_STORE_META_SUFFIX}`;
}

function getChunkKey(key: string, index: number) {
    return `${key}${SECURE_STORE_CHUNK_SUFFIX}${index}`;
}

export const secureSessionStorage = {
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
        return SecureStore.getItemAsync(key);
    },
    setItem: async (key: string, value: string) => {
        if (value.length <= SECURE_STORE_CHUNK_SIZE) {
            await SecureStore.setItemAsync(key, value);
            const staleCount = Number(
                (await SecureStore.getItemAsync(getMetaKey(key))) || 0,
            );
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
        const chunkCount = Number(
            (await SecureStore.getItemAsync(getMetaKey(key))) || 0,
        );
        if (Number.isInteger(chunkCount) && chunkCount > 0) {
            for (let i = 0; i < chunkCount; i += 1) {
                await SecureStore.deleteItemAsync(getChunkKey(key, i));
            }
            await SecureStore.deleteItemAsync(getMetaKey(key));
        }
        await SecureStore.deleteItemAsync(key);
    },
};
