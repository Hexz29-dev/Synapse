import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'recovery'; session: Session }
  | { status: 'signed-in'; session: Session };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState(data.session ? { status: 'signed-in', session: data.session } : { status: 'signed-out' });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        setState({ status: 'recovery', session });
      } else if (session) {
        // Mantém a tela de nova senha até o usuário concluir
        setState((prev) =>
          prev.status === 'recovery' && event !== 'USER_UPDATED' ? prev : { status: 'signed-in', session }
        );
      } else {
        setState({ status: 'signed-out' });
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

