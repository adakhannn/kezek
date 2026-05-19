import { isBusyAuthState, transitionAuthUiState, type AuthUiState } from '../../screens/auth/hooks/authUiState';

describe('authUiState', () => {
    test('marks only loading and pending as busy', () => {
        const states: AuthUiState[] = [
            'idle',
            'loading',
            'pending',
            'success',
            'error',
            'cancel',
            'expired',
        ];

        const busyStates = states.filter((state) => isBusyAuthState(state));
        expect(busyStates).toEqual(['loading', 'pending']);
    });

    test('applies deterministic transitions', () => {
        expect(transitionAuthUiState('idle', 'start')).toBe('loading');
        expect(transitionAuthUiState('loading', 'wait')).toBe('pending');
        expect(transitionAuthUiState('pending', 'succeed')).toBe('success');
        expect(transitionAuthUiState('pending', 'fail')).toBe('error');
        expect(transitionAuthUiState('pending', 'cancel')).toBe('cancel');
        expect(transitionAuthUiState('pending', 'expire')).toBe('expired');
    });

    test('reset returns to idle only from active flow states', () => {
        expect(transitionAuthUiState('loading', 'reset')).toBe('idle');
        expect(transitionAuthUiState('pending', 'reset')).toBe('idle');
        expect(transitionAuthUiState('success', 'reset')).toBe('success');
        expect(transitionAuthUiState('error', 'reset')).toBe('error');
    });
});
