export function bookingRpcResult<T>(result: T) {
    return { abortSignal: jest.fn(async (_signal: AbortSignal) => result) };
}
export function bookingRpcFailure(error: Error) {
    return { abortSignal: jest.fn(async (_signal: AbortSignal) => { throw error; }) };
}
