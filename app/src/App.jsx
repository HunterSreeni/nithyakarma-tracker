import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AuthPage from './components/AuthPage'
import Onboarding from './components/Onboarding'
import Layout from './components/Layout'
import TodayPage from './components/TodayPage'
import HistoryPage from './components/HistoryPage'
import SabhaPage from './components/SabhaPage'
import ProfilePage from './components/ProfilePage'
import { TermsPage, PrivacyPage } from './components/LegalPages'

function Gate() {
  const { session, profile, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <div className="spinner-wrap">Loading...</div>
  // Legal pages are reachable standalone whether signed in or not (Play Store requirement)
  if (pathname === '/terms') return <TermsPage />
  if (pathname === '/privacy') return <PrivacyPage />
  if (!session) return <AuthPage />
  if (!profile) return <Onboarding />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/sabha" element={<SabhaPage />} />
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
