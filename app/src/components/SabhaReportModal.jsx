import { useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../utils/friendlyError'

// Report or hide one Sabha name (Apple guideline 1.2: report + block for content
// from users). Reporting also hides the name for the reporter.
export default function SabhaReportModal({ row, onClose, onHide }) {
  const modalRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  useFocusTrap(modalRef, true)

  const report = async () => {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('report_leaderboard_name', { p_subject_id: row.subject_id })
    setBusy(false)
    if (err) { setError(friendlyError(err)); return }
    onHide(row.subject_id, 'reported')
  }

  return (
    <div className="modal-dim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sabha-report-title"
        tabIndex={-1} ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="cel-streak" id="sabha-report-title">{row.display_name}</div>
        <div className="cel-sub" style={{ marginBottom: '0.8rem' }}>
          Is this name offensive? Report it and we will review it. We also hide it for you.
        </div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="btn-auth" type="button" onClick={report} disabled={busy}>
          {busy ? 'Reporting...' : 'Report name'}
        </button>
        <button className="btn-plain" type="button" onClick={() => onHide(row.subject_id, 'hidden')} disabled={busy}>
          Hide from my Sabha
        </button>
        <button className="btn-plain" type="button" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </div>
  )
}
