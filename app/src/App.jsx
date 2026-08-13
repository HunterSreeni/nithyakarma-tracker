import { Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AuthPage from './components/AuthPage'
import Layout from './components/Layout'
import TodayPage from './components/TodayPage'
import { lazyWithRetry } from './utils/lazyWithRetry'

// Deferred: only fetched when actually navigated to, keeping them out of the
// initial bundle everyone downloads just to see Today.
const Onboarding = lazyWithRetry(() => import('./components/Onboarding'))
const NotificationPrompt = lazyWithRetry(() => import('./components/NotificationPrompt'))
const HistoryPage = lazyWithRetry(() => import('./components/HistoryPage'))
const SabhaPage = lazyWithRetry(() => import('./components/SabhaPage'))
const ReferralsPage = lazyWithRetry(() => import('./components/ReferralsPage'))
const ProfilePage = lazyWithRetry(() => import('./components/ProfilePage'))
const TermsPage = lazyWithRetry(() => import('./components/LegalPages').then(m => ({ default: m.TermsPage })))
const PrivacyPage = lazyWithRetry(() => import('./components/LegalPages').then(m => ({ default: m.PrivacyPage })))
const AboutPage = lazyWithRetry(() => import('./components/InfoPages').then(m => ({ default: m.AboutPage })))
const KarmaPage = lazyWithRetry(() => import('./components/InfoPages').then(m => ({ default: m.KarmaPage })))
const ResetPassword = lazyWithRetry(() => import('./components/ResetPassword'))
const RamayanaMasamPage = lazyWithRetry(() => import('./components/RamayanaMasamPage'))

// Lazy: verse content + page code only download when Learning is opened,
// not on every app load (Intent 2.1a - the first code-split route).
const LearningHub = lazyWithRetry(() => import('./components/LearningHub'))
const LearningPage = lazyWithRetry(() => import('./components/LearningPage'))
const RamayanamPage = lazyWithRetry(() => import('./components/RamayanamPage'))
const KandamPage = lazyWithRetry(() => import('./components/KandamPage'))
const DeviMahatmyamPage = lazyWithRetry(() => import('./components/DeviMahatmyamPage'))

function Gate() {
  const { session, profile, loading, dataStatus, justOnboarded, clearJustOnboarded } = useAuth()
  const { pathname } = useLocation()
  // Cheap watchdog for the one loading state that fully blanks the app: if
  // something upstream still manages to hang despite the guards in useAuth,
  // don't leave the user staring at a spinner forever.
  const [stuck, setStuck] = useState(false)
  // 55s, not 15s: getSession() routes token refresh through auth-js's own
  // GoTrueClient, which retries a failed/timed-out refresh internally with
  // backoff for up to ~30s (its hardcoded AUTO_REFRESH_TICK_DURATION_MS) -
  // our REQUEST_TIMEOUT_MS abort (lib/supabase.js) doesn't stop that, it just
  // gets caught and retried by auth-js, so one flaky reconnect (radio/DNS
  // still settling right after Android wakes the WebView - the exact moment
  // a stale-token resume happens) can chain 2-3 of those 12s timeouts into
  // ~30-37s before getSession() resolves. loadProfile() runs after that,
  // capped at another ~12s. A 15s watchdog fired mid-recovery and showed the
  // Reload wall even though the app was about to load fine on its own - this
  // is why the wall kept reappearing after the loadProfile-only fix
  // (2026-08-09) shipped: that fix addressed a real but smaller compounding
  // issue one stage later, not this one. See lib/supabase.js for the timeout
  // this budgets against.
  const STUCK_TIMEOUT_MS = 55000
  // Fires the notification prompt exactly once, right when onboarding
  // actually completes - driven by useAuth's justOnboarded flag, not by
  // session/profile timing. Session appearing before profile has loaded also
  // happens on every live sign-in of an *existing* user (profile is fetched
  // in a separate async call after the auth event), so inferring "just
  // onboarded" from that timing showed this prompt on every login, not just
  // the first one (fixed 2026-07-23).
  const [showNotifPrompt, setShowNotifPrompt] = useState(false)
  useEffect(() => {
    if (justOnboarded) {
      setShowNotifPrompt(true)
      clearJustOnboarded()
    }
  }, [justOnboarded, clearJustOnboarded])
  useEffect(() => {
    if (!loading) { setStuck(false); return }
    const t = setTimeout(() => setStuck(true), STUCK_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [loading])
  if (loading) {
    if (stuck) {
      return (
        <div className="spinner-wrap stuck">
          <div>Taking longer than expected.</div>
          <button type="button" className="btn-auth" onClick={() => window.location.reload()}>Reload</button>
        </div>
      )
    }
    return <div className="spinner-wrap">Loading...</div>
  }
  if (!session && dataStatus === 'offline') {
    return (
      <div className="spinner-wrap stuck">
        <div>You're offline. Reconnect to continue.</div>
      </div>
    )
  }
  // Legal and info pages are reachable standalone whether signed in or not
  // (Play Store requirement for /terms and /privacy; /about and /karma follow
  // the same pattern so they can be linked from outside the app too).
  if (pathname === '/terms') return <Suspense fallback={<div className="spinner-wrap">Loading...</div>}><TermsPage /></Suspense>
  if (pathname === '/privacy') return <Suspense fallback={<div className="spinner-wrap">Loading...</div>}><PrivacyPage /></Suspense>
  if (pathname === '/about') return <Suspense fallback={<div className="spinner-wrap">Loading...</div>}><AboutPage /></Suspense>
  if (pathname === '/karma') return <Suspense fallback={<div className="spinner-wrap">Loading...</div>}><KarmaPage /></Suspense>
  // Reachable during the recovery session so it isn't skipped into the app.
  if (pathname === '/reset') return <Suspense fallback={<div className="spinner-wrap">Loading...</div>}><ResetPassword /></Suspense>
  if (!session) return <AuthPage />
  if (!profile) return <Suspense fallback={<div className="spinner-wrap">Loading...</div>}><Onboarding /></Suspense>
  if (showNotifPrompt) {
    return (
      <Suspense fallback={<div className="spinner-wrap">Loading...</div>}>
        <NotificationPrompt onDone={() => setShowNotifPrompt(false)} />
      </Suspense>
    )
  }
  return (
    <Layout>
      <Suspense fallback={<div className="spinner-wrap">Loading...</div>}>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/learning" element={<LearningHub />} />
          <Route path="/learning/ramayanam" element={<RamayanamPage />} />
          <Route path="/learning/ramayanam/:kandam" element={<KandamPage />} />
          <Route path="/learning/ramayanam/:kandam/:sarga" element={<KandamPage />} />
          <Route path="/learning/devi-mahatmyam" element={<DeviMahatmyamPage />} />
          <Route path="/learning/devi-mahatmyam/:chapter" element={<DeviMahatmyamPage />} />
          <Route path="/learning/:slug" element={<LearningPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/sabha" element={<SabhaPage />} />
          <Route path="/referrals" element={<ReferralsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/ramayana-masam" element={<RamayanaMasamPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}
