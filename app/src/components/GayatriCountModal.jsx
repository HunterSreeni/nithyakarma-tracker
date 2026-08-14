import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { SANDHYA_SLOTS } from '../utils/cadence'

// Asks how many Gayatri japa were done for a Sandhyavandhanam slot. Replaces
// the old silent auto-fill of target_count (108) - the user always types the
// real number now, for all 3 slots.
export default function GayatriCountModal({ slot, onCancel, onConfirm }) {
  const modalRef = useRef(null)
  const inputRef = useRef(null)
  const [count, setCount] = useState('108')
  const [error, setError] = useState(null)
  useFocusTrap(modalRef, true)
  // useFocusTrap focuses the count field on mount (it's the first focusable
  // element), which pops the Android soft keyboard for a value most users
  // leave at the 108 default. Blur it right back so the keyboard never opens -
  // that open/dismiss cycle is what left the celebration modal that follows
  // (after Save) untappable on-device (see android-e2e-sandhya-gotchas memory).
  // Users who do want to edit the count can still tap the field themselves.
  useEffect(() => { inputRef.current?.blur() }, [])

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
        <div className="cel-sub" style={{ marginBottom: '0.8rem' }}>How many Gayatri japa did you do?</div>
        <form onSubmit={confirm} noValidate>
          <input ref={inputRef} className="field-input" type="number" min="1" step="1" inputMode="numeric"
            value={count} onChange={e => setCount(e.target.value)} />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="btn-auth" type="submit">Save</button>
          <button className="btn-plain" type="button" onClick={onCancel}>Cancel</button>
        </form>
      </div>
    </div>
  )
}
