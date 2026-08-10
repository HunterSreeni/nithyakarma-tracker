import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { track } from '../utils/analytics'
import { clearTodayCache } from '../utils/todayCache'
import { deviceTimezone } from '../utils/timezone'

const AuthContext = createContext(null)

// Custom scheme Google OAuth returns to on native (AndroidManifest.xml has the
// matching intent-filter). Web keeps using window.location.origin.
const NATIVE_OAUTH_REDIRECT = 'org.nithyakarma.app://auth-callback'

// Last-known session/profile/familyMembers, so a cold restart (Android kills
// the WebView process after long backgrounding - see App.jsx's Gate() watchdog
// comment) can paint the app instantly from what we showed last time instead
// of blocking behind a fresh getSession()+loadProfile() round trip, which on a
// stale/expired token can legitimately take up to ~30-40s (auth-js's own
// refresh-retry budget). Self-corrects once that real fetch resolves - see
// loadProfile() below, which is the sole writer, and signOut()/the "no
// session" branches below, which are the sole clearers.
const PROFILE_CACHE_KEY = 'nk_profile_cache_v1'

function readProfileCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY))
    return cached?.userId ? cached : null
  } catch {
    return null // corrupt JSON / private-mode storage access - just skip the cache
  }
}

function writeProfileCache(session, profile, familyMembers) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
      userId: session.user.id, email: session.user.email, profile, familyMembers,
    }))
  } catch {
    // quota / private mode - caching is an optimization, not required
  }
}

function clearProfileCache() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY) } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
  // Cheap (a few KB of JSON) - fine to read once per render rather than thread
  // through a ref, and only its first-render value is ever used below.
  const cached = readProfileCache()
  const [session, setSession] = useState(cached && { user: { id: cached.userId, email: cached.email } })
  const [profile, setProfile] = useState(cached?.profile ?? null)
  const [familyMembers, setFamilyMembers] = useState(cached?.familyMembers ?? [])
  // null = self, otherwise a family_members row (parent tracks the child)
  const [selectedMember, setSelectedMember] = useState(null)
  const [loading, setLoading] = useState(!cached)
  // Set only by createProfile() completing - the one true "onboarding just
  // finished" signal. Session-appears-before-profile-loads is NOT a reliable
  // proxy for this: it also happens on every live sign-in of an *existing*
  // user, since profile is fetched in a separate async call after the auth
  // event fires (see the sign-in bug this replaced, 2026-07-23).
  const [justOnboarded, setJustOnboarded] = useState(false)
  const clearJustOnboarded = useCallback(() => setJustOnboarded(false), [])

  // Parallel, not sequential: each Supabase call is independently capped at
  // REQUEST_TIMEOUT_MS (see lib/supabase.js), but two of those stacked one
  // after another can still add up to ~2x that - enough to blow past the
  // 15s "stuck" watchdog in App.jsx's Gate() on a just-reconnected network
  // (e.g. resuming from a long background), landing on the "Taking longer
  // than expected" Reload wall instead of finishing normally.
  // Takes the full session (not just the id) so it can key the cache by
  // session.user.email too - see writeProfileCache above.
  const loadProfile = useCallback(async (session) => {
    const uid = session.user.id
    const [{ data }, { data: fam }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('family_members').select('*').eq('parent_id', uid).order('name'),
    ])
    let profile = data ?? null
    const familyMembers = fam ?? []
    // Keep profiles.timezone tracking the device. It drives decay_stale_streaks'
    // idea of "today" for this account and its children (migration
    // 20260810120000), so a stale value costs the user a streak at the wrong
    // local midnight. Doing it here rather than only in the notification
    // toggle matters: most accounts never reach that toggle, and this also
    // follows the user when they move between India and the UAE. Optimistic
    // locally, fire-and-forget remotely - a failed write just retries next load.
    const tz = deviceTimezone()
    if (profile && profile.timezone !== tz) {
      profile = { ...profile, timezone: tz }
      try {
        supabase.from('profiles').update({ timezone: tz }).eq('id', uid).then(undefined, () => {})
      } catch { /* a background write must never break the load path */ }
    }
    setProfile(profile)
    setFamilyMembers(familyMembers)
    // selectedMember is a row snapshot taken when the chip was tapped
    // (ProfileSwitcher), so it goes stale the moment that child's streak /
    // freeze_credits / last_complete_date change. Re-point it at the freshly
    // loaded row. Without this, marking a practice for a child leaves the
    // Today card reading the pre-mark values - which since utils/streak.js
    // landed means the "you missed yesterday, mark today or it resets" banner
    // stays up after the freeze has already been spent and the streak saved.
    // Drops the selection if that child no longer exists.
    setSelectedMember(prev => prev ? (familyMembers.find(f => f.id === prev.id) ?? null) : null)
    writeProfileCache(session, profile, familyMembers)
    return { profile, familyMembers }
  }, [])

  useEffect(() => {
    // A rejected getSession()/loadProfile() (expired refresh token, network
    // not ready right after a long-backgrounded resume) must never leave
    // loading stuck true - it gates the entire app (see App.jsx's Gate()).
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) await loadProfile(session).catch(() => {})
      else { setProfile(null); setFamilyMembers([]); setSelectedMember(null); clearProfileCache(); clearTodayCache() }
      setLoading(false)
    }).catch(() => setLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) await loadProfile(session).catch(() => {})
      else { setProfile(null); setFamilyMembers([]); setSelectedMember(null); clearProfileCache(); clearTodayCache() }
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
  // Clear our own cache eagerly rather than waiting on onAuthStateChange's
  // SIGNED_OUT branch - avoids a window where a fast subsequent reload (or a
  // different user signing in on a shared device) could still read stale data.
  const signOut = () => { clearProfileCache(); clearTodayCache(); return supabase.auth.signOut() }

  // Recovery: email a reset link that returns to /reset, then set the new password.
  const resetPassword = (email, captchaToken) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/reset`,
      captchaToken,
    })
  const updatePassword = (password) => supabase.auth.updateUser({ password })

  // Onboarding: create the profile row (RLS: id must equal auth.uid()).
  const createProfile = async ({ displayName, gender, isMarried, panchangamTradition, referralCode }) => {
    const { error } = await supabase.from('profiles').insert({
      id: session.user.id, display_name: displayName, gender,
      is_married: gender === 'male' ? !!isMarried : false,
      panchangam_tradition: panchangamTradition ?? 'tamil',
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
    await loadProfile(session)
    setJustOnboarded(true)
    // Lets GuidedTour know this account just onboarded in this browser
    // session, since justOnboarded itself gets cleared by App.jsx's Gate
    // before the Today page ever mounts (see GuidedTour.jsx).
    try { sessionStorage.setItem('nk_onboarded_session', '1') } catch { /* private mode */ }
  }

  const updateProfile = async (fields) => {
    const { error } = await supabase.from('profiles').update(fields).eq('id', session.user.id)
    if (error) throw error
    await loadProfile(session)
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
    await loadProfile(session)
    return data
  }

  const removeFamilyMember = async (id) => {
    const { error } = await supabase.from('family_members').delete().eq('id', id)
    if (error) throw error
    if (selectedMember?.id === id) setSelectedMember(null)
    await loadProfile(session)
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
    refresh: () => session && loadProfile(session),
    justOnboarded, clearJustOnboarded,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
