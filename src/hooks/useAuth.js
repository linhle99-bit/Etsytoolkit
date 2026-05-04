import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseEnabled } from '../lib/supabase'

// Quản lý session Supabase: signUp, signIn, signOut, currentUser.
// Nếu env chưa set, hook trả về `enabled: false` để UI ẩn auth UI.

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!supabaseEnabled) {
      setLoading(false)
      return
    }
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setLoading(false)
      }
    })
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    setError(null)
    if (!supabaseEnabled) {
      setError('Supabase chưa cấu hình')
      return { error: 'Supabase chưa cấu hình' }
    }
    const { data, error: e } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })
    if (e) {
      setError(e.message)
      return { error: e.message }
    }
    return { data }
  }, [])

  const signUp = useCallback(async (email, password) => {
    setError(null)
    if (!supabaseEnabled) {
      setError('Supabase chưa cấu hình')
      return { error: 'Supabase chưa cấu hình' }
    }
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password
    })
    if (e) {
      setError(e.message)
      return { error: e.message }
    }
    return { data }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabaseEnabled) return
    await supabase.auth.signOut()
    setSession(null)
  }, [])

  const resendConfirmation = useCallback(async email => {
    if (!supabaseEnabled) return { error: 'Supabase chưa cấu hình' }
    const { error: e } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim()
    })
    if (e) return { error: e.message }
    return { ok: true }
  }, [])

  return {
    enabled: supabaseEnabled,
    session,
    user: session?.user || null,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    resendConfirmation
  }
}
