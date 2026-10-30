/** A rejected Next chunk load stays cached in the current JS runtime. */
export function isRecoverableChunkError(error: Error | null): boolean {
    if (!error) return false;
    return error.name === 'ChunkLoadError'
        || /^Loading (?:CSS )?chunk \S+ failed(?:\.|$)/i.test(error.message)
        || /^Failed to load chunk (?:https?:\/\/[^\s/]+)?\/_next\/static\/chunks\/\S+\.(?:js|css)(?: from module \S+)?$/i.test(error.message);
}
