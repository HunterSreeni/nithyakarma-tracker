import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AuthPage from './components/AuthPage'
import Onboarding from './components/Onboarding'
import Layout from './components/Layout'
import TodayPage from './components/TodayPage'
import HistoryPage from './components/HistoryPage'
import SabhaPage from './components/SabhaPage'
import ReferralsPage from './components/ReferralsPage'
import ProfilePage from './components/ProfilePage'
import { TermsPage, PrivacyPage } from './components/LegalPages'
import ResetPassword from './components/ResetPassword'

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
  // Legal pages are reachable standalone whether signed in or not (Play Store requirement)
  if (pathname === '/terms') return <TermsPage />
  if (pathname === '/privacy') return <PrivacyPage />
  // Reachable during the recovery session so it isn't skipped into the app.
  if (pathname === '/reset') return <ResetPassword />
  if (!session) return <AuthPage />
  if (!profile) return <Onboarding />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/sabha" element={<SabhaPage />} />
        <Route path="/referrals" element={<ReferralsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
