import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AuthPage from './components/AuthPage'
import Layout from './components/Layout'
import TodayPage from './components/TodayPage'

// Deferred: only fetched when actually navigated to, keeping them out of the
// initial bundle everyone downloads just to see Today.
const Onboarding = lazy(() => import('./components/Onboarding'))
const HistoryPage = lazy(() => import('./components/HistoryPage'))
const SabhaPage = lazy(() => import('./components/SabhaPage'))
const ReferralsPage = lazy(() => import('./components/ReferralsPage'))
const ProfilePage = lazy(() => import('./components/ProfilePage'))
const TermsPage = lazy(() => import('./components/LegalPages').then(m => ({ default: m.TermsPage })))
const PrivacyPage = lazy(() => import('./components/LegalPages').then(m => ({ default: m.PrivacyPage })))
const AboutPage = lazy(() => import('./components/InfoPages').then(m => ({ default: m.AboutPage })))
const KarmaPage = lazy(() => import('./components/InfoPages').then(m => ({ default: m.KarmaPage })))
const ResetPassword = lazy(() => import('./components/ResetPassword'))
const RamayanaMasamPage = lazy(() => import('./components/RamayanaMasamPage'))

// Lazy: verse content + page code only download when Learning is opened,
// not on every app load (Intent 2.1a - the first code-split route).
const LearningHub = lazy(() => import('./components/LearningHub'))
const LearningPage = lazy(() => import('./components/LearningPage'))

function Gate() {
  const { session, profile, loading } = useAuth()
  const { pathname } = useLocation()
  // Cheap watchdog for the one loading state that fully blanks the app: if
  // something upstream still manages to hang despite the guards in useAuth,
  // don't leave the user staring at a spinner forever.
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    if (!loading) { setStuck(false); return }
    const t = setTimeout(() => setStuck(true), 15000)
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
  return (
    <Layout>
      <Suspense fallback={<div className="spinner-wrap">Loading...</div>}>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/learning" element={<LearningHub />} />
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
