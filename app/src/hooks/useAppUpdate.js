import { useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'
import { checkAppUpdate } from '../utils/appUpdate'

// One shared update state for the whole app: the gate reads "required", the
// Today page reads "suggested". Checked at start-up and every time the app
// comes back to the foreground; a dismissed card stays hidden until the app
// is next started (the flag lives in memory only).
let state = { status: 'ok', dismissed: false }
const listeners = new Set()
let started = false
let seq = 0
// AI-DEV NOTE: on native the gate holds the app behind "checking" until the
// first answer, so sign-in or content never flashes before a required-update
// screen. Capped: after this long the app opens anyway (fail open) and a late
// "required" answer still takes over when it lands.
const FIRST_CHECK_CAP_MS = 3000

function setState(next) {
  state = next
  listeners.forEach((l) => l())
}

async function runCheck() {
  const mine = ++seq
  const result = await checkAppUpdate()
  // A slower, older check must not overwrite a newer answer.
  if (mine === seq) setState({ ...result, dismissed: state.dismissed })
}

export function startAppUpdateChecks() {
  if (started) return
  started = true
  if (Capacitor.isNativePlatform()) {
    setState({ ...state, status: 'checking' })
    setTimeout(() => { if (state.status === 'checking') setState({ ...state, status: 'ok' }) }, FIRST_CHECK_CAP_MS)
  }
  runCheck()
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => { if (isActive) runCheck() })
    }).catch(() => {})
  }
}

export function dismissSuggestedUpdate() {
  setState({ ...state, dismissed: true })
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAppUpdate() {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

// Tests only.
export function _resetAppUpdate() {
  state = { status: 'ok', dismissed: false }
  started = false
  seq = 0
  listeners.clear()
}
