import { Capacitor } from '@capacitor/core'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { supabase } from './supabase'
import { queryClient, withDeadline } from './queryClient'
import * as Sentry from '@sentry/react'

let recoveryPromise = null
let generation = 0
let snapshot = { status: 'ready', generation, error: null }
const subscribers = new Set()

function publish(status, error = null) {
  snapshot = { status, generation, error }
  Sentry.addBreadcrumb({
    category: 'data-lifecycle',
    level: error ? 'warning' : 'info',
    message: status,
    data: { generation, errorName: error?.name },
  })
  subscribers.forEach(listener => listener())
}

export function subscribeDataLifecycle(listener) {
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}

export function getDataLifecycleSnapshot() {
  return snapshot
}

async function networkIsOnline() {
  try {
    const { Network } = await import('@capacitor/network')
    return (await Network.getStatus()).connected
  } catch {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false
  }
}

// All foreground paths share one recovery promise. This prevents each screen
// from racing its own getSession/refresh call as the WebView wakes up.
export function recoverDataSession({ invalidate = true } = {}) {
  if (recoveryPromise) return recoveryPromise

  recoveryPromise = (async () => {
    generation += 1
    focusManager.setFocused(false)
    publish('recovering')

    if (!(await networkIsOnline())) {
      onlineManager.setOnline(false)
      publish('offline')
      return { data: { session: null }, offline: true }
    }

    onlineManager.setOnline(true)
    supabase.auth.startAutoRefresh()
    try {
      const result = await withDeadline(supabase.auth.getSession(), 'Session recovery')
      if (result.error) throw result.error
      publish('ready')
      focusManager.setFocused(true)
      if (invalidate) queryClient.invalidateQueries({ refetchType: 'active' }).catch(() => {})
      return result
    } catch (error) {
      publish('error', error)
      Sentry.captureException(error, { tags: { stage: 'foreground-session-recovery' } })
      // Queries still get a chance to use cached data or reach their own
      // bounded error state; focus must never remain permanently paused.
      focusManager.setFocused(true)
      throw error
    }
  })().finally(() => { recoveryPromise = null })

  return recoveryPromise
}

export function setupDataLifecycle() {
  let disposed = false
  const removers = []

  const becomeInactive = () => {
    generation += 1
    publish('background')
    focusManager.setFocused(false)
    queryClient.cancelQueries()
    supabase.auth.stopAutoRefresh()
  }
  const becomeActive = () => { recoverDataSession().catch(() => {}) }

  if (Capacitor.isNativePlatform()) {
    import('@capacitor/app').then(({ App }) => {
      if (disposed) return
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) becomeActive()
        else becomeInactive()
      }).then(handle => removers.push(() => handle.remove()))
    })
  } else {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') becomeActive()
      else becomeInactive()
    }
    document.addEventListener('visibilitychange', onVisibility)
    removers.push(() => document.removeEventListener('visibilitychange', onVisibility))
  }

  import('@capacitor/network').then(({ Network }) => {
    if (disposed) return
    Network.getStatus().then(status => onlineManager.setOnline(status.connected)).catch(() => {})
    Network.addListener('networkStatusChange', status => {
      onlineManager.setOnline(status.connected)
      if (status.connected && snapshot.status === 'offline') becomeActive()
      if (!status.connected) publish('offline')
    }).then(handle => removers.push(() => handle.remove()))
  }).catch(() => {})

  return () => {
    disposed = true
    removers.forEach(remove => remove())
  }
}
