import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [familyMembers, setFamilyMembers] = useState([])
  // null = self, otherwise a family_members row (parent tracks the child)
  const [selectedMember, setSelectedMember] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data ?? null)
    const { data: fam } = await supabase.from('family_members')
      .select('*').eq('parent_id', uid).order('name')
    setFamilyMembers(fam ?? [])
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) await loadProfile(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) await loadProfile(session.user.id)
      else { setProfile(null); setFamilyMembers([]); setSelectedMember(null) }
    })
    return () => subscription.unsubscribe()
  }, [loadProfile])

  const signInGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })

  const signInEmail = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signUpEmail = (email, password) => supabase.auth.signUp({ email, password })
  const signOut = () => supabase.auth.signOut()

  // Onboarding: create the profile row (RLS: id must equal auth.uid()).
  const createProfile = async ({ displayName, gender, referralCode }) => {
    const { error } = await supabase.from('profiles').insert({
      id: session.user.id, display_name: displayName, gender,
    })
    if (error) throw error
    if (referralCode) {
      // best-effort: an invalid code must not block signup
      await supabase.rpc('apply_referral', { p_code: referralCode }).catch(() => {})
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
    await loadProfile(session.user.id)
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

  // Cascade: profile delete removes family_members, user_practices, logs,
  // referrals via ON DELETE CASCADE. Then sign out.
  const deleteAccount = async () => {
    const { error } = await supabase.from('profiles').delete().eq('id', session.user.id)
    if (error) throw error
    await signOut()
  }

  const value = {
    session, profile, familyMembers, selectedMember, setSelectedMember, loading,
    signInGoogle, signInEmail, signUpEmail, signOut,
    createProfile, updateProfile, addFamilyMember, removeFamilyMember, deleteAccount,
    refresh: () => session && loadProfile(session.user.id),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
