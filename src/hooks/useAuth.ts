import { useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
}

interface UseAuthReturn extends AuthState {
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
  })

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setState((prev) => ({ ...prev, profile: data as Profile | null }))
    } catch {
      // non bloquant
    }
  }, [])

  useEffect(() => {
    // Timeout de sécurité : si onAuthStateChange ne tire pas dans 5s, on débloque quand même.
    const timeout = setTimeout(() => {
      setState((s) => ({ ...s, loading: false }))
    }, 5000)

    // onAuthStateChange émet INITIAL_SESSION immédiatement avec la session
    // stockée en localStorage — sans appel réseau. C'est la source de vérité.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        clearTimeout(timeout)
        setState((prev) => ({
          ...prev,
          session,
          user: session?.user ?? null,
          loading: false,
        }))
        if (session?.user) loadProfile(session.user.id)
        else setState((prev) => ({ ...prev, profile: null }))
      }
    )

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // [] intentionnel

  const signUp = useCallback(async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName ?? email.split('@')[0] } },
    })
    return { error: error?.message ?? null }
  }, [])

  const signIn = useCallback(async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return { ...state, signUp, signIn, signOut }
}
