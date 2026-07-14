import { useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { scheduleAllReminders } from '../utils/notifications'

const TABS = [
  { to: '/', label: 'Today', icon: '🏠' },
  { to: '/history', label: 'History', icon: '📖' },
  { to: '/sabha', label: 'Sabha', icon: '🏆' },
  { to: '/profile', label: 'Profile', icon: '👤' },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const initials = (profile?.display_name ?? '')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => {
    if (profile) scheduleAllReminders({ includeSandhya: profile.gender === 'male' })
  }, [profile?.gender]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="wordmark">
          <span className="name">Nithya<span>karma</span></span>
        </Link>
        <nav className="nav-tabs" aria-label="Primary">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}
              className={({ isActive }) => `nav-tab ${isActive ? 'on' : ''}`}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="top-right">
          <div className="streak-pill">🔥 {profile?.current_streak ?? 0}</div>
          <Link to="/profile" className="top-avatar" style={{ textDecoration: 'none' }} aria-label="Profile">{initials}</Link>
          <button className="nav-logout" onClick={signOut}>Logout</button>
        </div>
      </header>
      <main className="content">{children}</main>
      <nav className="bottomnav" aria-label="Bottom">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {t.icon}<span className="nl">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
