import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { track } from '../utils/analytics'

const AuthContext = createContext(null)

// Custom scheme Google OAuth returns to on native (AndroidManifest.xml has the
// matching intent-filter). Web keeps using window.location.origin.
const NATIVE_OAUTH_REDIRECT = 'org.nithyakarma.app://auth-callback'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [familyMembers, setFamilyMembers] = useState([])
  // null = self, otherwise a family_members row (parent tracks the child)
  const [selectedMember, setSelectedMember] = useState(null)
  const [loading, setLoading] = useState(true)
  // Set only by createProfile() completing - the one true "onboarding just
  // finished" signal. Session-appears-before-profile-loads is NOT a reliable
  // proxy for this: it also happens on every live sign-in of an *existing*
  // user, since profile is fetched in a separate async call after the auth
  // event fires (see the sign-in bug this replaced, 2026-07-23).
  const [justOnboarded, setJustOnboarded] = useState(false)
  const clearJustOnboarded = useCallback(() => setJustOnboarded(false), [])

  const loadProfile = useCallback(async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(data ?? null)
    const { data: fam } = await supabase.from('family_members')
      .select('*').eq('parent_id', uid).order('name')
    setFamilyMembers(fam ?? [])
  }, [])

  useEffect(() => {
    // A rejected getSession()/loadProfile() (expired refresh token, network
    // not ready right after a long-backgrounded resume) must never leave
    // loading stuck true - it gates the entire app (see App.jsx's Gate()).
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) await loadProfile(session.user.id).catch(() => {})
      setLoading(false)
    }).catch(() => setLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) await loadProfile(session.user.id).catch(() => {})
      else { setProfile(null); setFamilyMembers([]); setSelectedMember(null) }
    })

    // Re-validate the session when the app returns to the foreground. A tab
    // or native webview backgrounded for 24h+ can resume with a session that
    // silently expired; nothing else re-checks it, so the UI would otherwise
    // keep showing whatever stale state it had before backgrounding. Feeding
    // getSession() re-triggers the onAuthStateChange handler above either way.
    const revalidate = () => { supabase.auth.getSession().catch(() => {}) }
    // Google OAuth on native returns via NATIVE_OAUTH_REDIRECT instead of a
    // web page load - Capacitor delivers that as an appUrlOpen event carrying
    // the full redirect URL (implicit flow: tokens are in the URL fragment,
    // matching this client's flowType - see lib/supabase.js).
    const handleOAuthRedirect = ({ url }) => {
      if (!url?.startsWith(NATIVE_OAUTH_REDIRECT)) return
      const params = new URLSearchParams(url.split('#')[1] ?? '')
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).catch(() => {})
      }
    }
    let removeResumeListener, removeUrlListener
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('resume', revalidate).then((handle) => { removeResumeListener = handle.remove })
        App.addListener('appUrlOpen', handleOAuthRedirect).then((handle) => { removeUrlListener = handle.remove })
      })
    } else {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') revalidate()
    }

    return () => {
      subscription.unsubscribe()
      removeResumeListener?.()
      removeUrlListener?.()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [loadProfile])

  const signInGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: Capacitor.isNativePlatform() ? NATIVE_OAUTH_REDIRECT : window.location.origin },
    })

  const signInEmail = (email, password, captchaToken) =>
    supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })
  const signUpEmail = (email, password, captchaToken) =>
    supabase.auth.signUp({ email, password, options: { captchaToken } })
  const signOut = () => supabase.auth.signOut()

  // Recovery: email a reset link that returns to /reset, then set the new password.
  const resetPassword = (email, captchaToken) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/reset`,
      captchaToken,
    })
  const updatePassword = (password) => supabase.auth.updateUser({ password })

  // Onboarding: create the profile row (RLS: id must equal auth.uid()).
  const createProfile = async ({ displayName, gender, referralCode }) => {
    const { error } = await supabase.from('profiles').insert({
      id: session.user.id, display_name: displayName, gender,
    })
    if (error) throw error
    if (referralCode) {
      // best-effort: an invalid code must not block signup
      try {
        await supabase.rpc('apply_referral', { p_code: referralCode })
      } catch {
        // ignore - invalid/self referral, etc.
      }
    }
    // Sandhyavandhanam is the constant practice for male users
    if (gender === 'male') {
      const { data: sandhya } = await supabase.from('practices')
        .select('id').eq('is_sandhyavandhanam', true).single()
      if (sandhya) {
        await supabase.from('user_practices').insert({
          owner_id: session.user.id, practice_id: sandhya.id,
        })
      }
    }
    track('onboarding_complete', { gender, referred: !!referralCode })
    await loadProfile(session.user.id)
    setJustOnboarded(true)
  }

  const updateProfile = async (fields) => {
    const { error } = await supabase.from('profiles').update(fields).eq('id', session.user.id)
    if (error) throw error
    await loadProfile(session.user.id)
  }

  const addFamilyMember = async ({ name, gender, upanayanamDone, balaSabhaOptIn }) => {
    const { data, error } = await supabase.from('family_members').insert({
      parent_id: session.user.id, name, gender,
      upanayanam_done: gender === 'male' ? upanayanamDone : false,
      bala_sabha_opt_in: balaSabhaOptIn,
    }).select().single()
    if (error) throw error
    // Boys with upanayanam done get Sandhyavandhanam automatically
    if (gender === 'male' && upanayanamDone) {
      const { data: sandhya } = await supabase.from('practices')
        .select('id').eq('is_sandhyavandhanam', true).single()
      if (sandhya) {
        await supabase.from('user_practices').insert({
          owner_id: session.user.id, family_member_id: data.id, practice_id: sandhya.id,
        })
      }
    }
    await loadProfile(session.user.id)
    return data
  }

  const removeFamilyMember = async (id) => {
    const { error } = await supabase.from('family_members').delete().eq('id', id)
    if (error) throw error
    if (selectedMember?.id === id) setSelectedMember(null)
    await loadProfile(session.user.id)
  }

  // Deletes the auth user, which cascades to the profile and all owned rows
  // (family_members, user_practices, logs, referrals). Removes the identity
  // itself, not just the profile row. Then sign out.
  const deleteAccount = async () => {
    const { error } = await supabase.rpc('delete_account')
    if (error) throw error
    await signOut()
  }

  const value = {
    session, profile, familyMembers, selectedMember, setSelectedMember, loading,
    signInGoogle, signInEmail, signUpEmail, signOut, resetPassword, updatePassword,
    createProfile, updateProfile, addFamilyMember, removeFamilyMember, deleteAccount,
    refresh: () => session && loadProfile(session.user.id),
    justOnboarded, clearJustOnboarded,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
