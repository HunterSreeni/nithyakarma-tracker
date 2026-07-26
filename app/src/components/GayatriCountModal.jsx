import { useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { SANDHYA_SLOTS } from '../utils/cadence'

// Asks how many Gayatri japa were done for a Sandhyavandhanam slot. Replaces
// the old silent auto-fill of target_count (108) - the user always types the
// real number now, for all 3 slots.
export default function GayatriCountModal({ slot, onCancel, onConfirm }) {
  const modalRef = useRef(null)
  const [count, setCount] = useState('108')
  const [error, setError] = useState(null)
  useFocusTrap(modalRef, true)

  const label = SANDHYA_SLOTS.find(s => s.key === slot)?.label ?? slot

  const confirm = (e) => {
    e.preventDefault()
    const n = Number(count)
    if (!Number.isInteger(n) || n < 1) { setError('Enter a whole number, 1 or more'); return }
    onConfirm(n)
  }

  return (
    <div className="modal-dim" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="gayatri-count-title"
        tabIndex={-1} ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="cel-streak" id="gayatri-count-title">{label} Gayatri Count</div>
        <div className="cel-sub">How many Gayatri japa did you do?</div>
        <form onSubmit={confirm}>
          <input className="field-input" type="number" min="1" step="1" inputMode="numeric"
            autoFocus value={count} onChange={e => setCount(e.target.value)} />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="btn-auth" type="submit">Save</button>
          <button className="btn-plain" type="button" onClick={onCancel}>Cancel</button>
        </form>
      </div>
    </div>
  )
}
