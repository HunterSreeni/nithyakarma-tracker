import { useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Home, BookOpen, Trophy, Gift, CircleUserRound, Flame } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { scheduleAllReminders } from '../utils/notifications'

const BASE_TABS = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/history', label: 'History', icon: BookOpen },
  { to: '/sabha', label: 'Sabha', icon: Trophy, community: true },
  { to: '/referrals', label: 'Referrals', icon: Gift },
  { to: '/profile', label: 'Profile', icon: CircleUserRound },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const initials = (profile?.display_name ?? '')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  // Community/Sabha is opt-in (default hidden) - see ProfilePage's toggle.
  const TABS = BASE_TABS.filter(t => !t.community || profile?.community_enabled)

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
          <div className="streak-pill"><Flame size={14} strokeWidth={2.5} /> {profile?.current_streak ?? 0}</div>
          <Link to="/profile" className="top-avatar" style={{ textDecoration: 'none' }} aria-label="Profile">{initials}</Link>
          <button className="nav-logout" onClick={signOut}>Logout</button>
        </div>
      </header>
      <main className="content">{children}</main>
      <nav className="bottomnav" aria-label="Bottom">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <t.icon size={20} strokeWidth={2} /><span className="nl">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
