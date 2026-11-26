import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export type NavigationSession = {
    session: Session | null;
    hasSession: boolean;
};

/**
 * The session RootNavigator holds (useRootNavigationSession), for the screens that need an
 * account: they show a sign-in entry instead of their content while nobody is signed in (C1).
 */
const NavigationSessionContext = createContext<NavigationSession>({ session: null, hasSession: false });

export const NavigationSessionProvider = NavigationSessionContext.Provider;

export function useNavigationSession(): NavigationSession {
    return useContext(NavigationSessionContext);
}
