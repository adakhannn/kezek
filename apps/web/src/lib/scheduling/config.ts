/** Enabled only after the reviewed database migration and end-to-end verification. */
export function explicitSchedulingEnabled(): boolean {
    return process.env.SCHEDULE_V2_ENABLED === 'true';
}
