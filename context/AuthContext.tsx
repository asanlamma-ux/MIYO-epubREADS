import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logger, captureError } from '@/utils/logger';
import type { Session, User } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

function parseUrlFragmentParams(url: string): Record<string, string> {
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') && !hash ? url.split('?')[1] : '';
  const segment = hash || query;
  if (!segment) return {};
  const params = new URLSearchParams(segment);
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null; success: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
      if (s) logger.info('Auth session restored', { email: s.user.email });
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        logger.error('Sign-up failed', error);
        return { error: error.message };
      }
      logger.info('Sign-up succeeded', { email });
      return { error: null };
    } catch (e) {
      captureError('Sign Up', e);
      return { error: 'An unexpected error occurred.' };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        logger.error('Sign-in failed', error);
        return { error: error.message };
      }
      logger.info('Sign-in succeeded', { email });
      return { error: null };
    } catch (e) {
      captureError('Sign In', e);
      return { error: 'An unexpected error occurred.' };
    }
  };

  const signInWithGoogle = async (): Promise<{ error: string | null; success: boolean }> => {
    if (!isSupabaseConfigured) {
      return {
        error: 'Add your Supabase URL and anon key in lib/supabase.ts, and enable Google provider in Supabase.',
        success: false,
      };
    }
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data?.url) {
        return { error: error?.message || 'Could not start Google sign-in.', success: false };
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        return { error: null, success: false };
      }
      const callbackUrl = result.url;
      if (callbackUrl.includes('code=')) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(callbackUrl);
        if (!exchangeError) {
          logger.info('Google sign-in completed (PKCE)');
          return { error: null, success: true };
        }
      }
      const params = parseUrlFragmentParams(callbackUrl);
      const access_token = params.access_token;
      const refresh_token = params.refresh_token;
      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (sessionError) return { error: sessionError.message, success: false };
        logger.info('Google sign-in completed');
        return { error: null, success: true };
      }
      return {
        error:
          'Could not read tokens from redirect. In Supabase Dashboard → Auth → URL config, add this redirect URL: ' +
          redirectTo,
        success: false,
      };
    } catch (e) {
      captureError('Google Sign In', e);
      return { error: 'Google sign-in failed.', success: false };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      logger.info('Signed out');
    } catch (e) {
      captureError('Sign Out', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session,
        isLoading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
