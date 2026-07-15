import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { shareUrl } from '../utils/share'
import { track } from '../utils/analytics'
import ErrorBanner from './ErrorBanner'
import { friendlyError } from '../utils/friendlyError'

// A plain outbound tracking list ("who joined with my link, and when") -
// deliberately not a competitive leaderboard. apply_referral() grants both
// parties +30 ad-free days AND +1 freeze credit (capped by tier), so the
// copy here names both rewards rather than just the ad-free month.
export default function ReferralsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { profile } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('get_my_referrals')
      if (rpcError) throw rpcError
      setRows(data ?? [])
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const initials = (n) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const inviteWhatsApp = () => {
    track('share_clicked', { from: 'referrals' })
    const text = `Join me on Nithyakarma - track your daily anushtanams!\n${shareUrl(profile.referral_code)}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <>
      <h1 className="greet" style={{ fontSize: '1.1rem' }}>Your Referrals</h1>
      <div className="greet-sub" style={{ marginBottom: '1rem' }}>People who joined with your link</div>

      {loading ? <div className="spinner-wrap">Loading...</div> : error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="referral-card">
          <div className="ref-title">Your referrals will appear here 🎁</div>
          <div className="ref-sub">
            Invite people with your link. When they join, they'll show up here -
            and you'll both get a month ad-free plus a streak freeze.
          </div>
          <button className="btn-ref" onClick={inviteWhatsApp}>Invite on WhatsApp</button>
        </div>
      ) : (
        <>
          {rows.map(r => <ReferralRow key={r.referred_id} r={r} initials={initials} />)}
          <button className="btn-secondary" onClick={inviteWhatsApp}>Invite another</button>
        </>
      )}
    </>
  )
}

function ReferralRow({ r, initials }) {
  const joined = new Date(r.joined_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <div className="ref-row">
      <div className="lb-avatar">{initials(r.display_name)}</div>
      <div className="lb-body">
        <div className="lb-name">{r.display_name}</div>
        <div className="ref-row-meta">Joined {joined}</div>
      </div>
      <div className="ref-row-tag">🎁 +1 mo · 🧊 +1</div>
    </div>
  )
}
