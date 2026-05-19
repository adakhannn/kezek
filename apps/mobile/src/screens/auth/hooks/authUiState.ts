export type AuthUiState =
    | 'idle'
    | 'loading'
    | 'pending'
    | 'success'
    | 'error'
    | 'cancel'
    | 'expired';

export type AuthUiEvent =
    | 'start'
    | 'wait'
    | 'succeed'
    | 'fail'
    | 'cancel'
    | 'expire'
    | 'reset';

export function isBusyAuthState(state: AuthUiState) {
    return state === 'loading' || state === 'pending';
}

export function transitionAuthUiState(
    current: AuthUiState,
    event: AuthUiEvent,
): AuthUiState {
    switch (event) {
        case 'start':
            return 'loading';
        case 'wait':
            return 'pending';
        case 'succeed':
            return 'success';
        case 'fail':
            return 'error';
        case 'cancel':
            return 'cancel';
        case 'expire':
            return 'expired';
        case 'reset':
            return current === 'loading' || current === 'pending' ? 'idle' : current;
        default:
            return current;
    }
}
