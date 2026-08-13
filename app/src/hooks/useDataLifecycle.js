import { useSyncExternalStore } from 'react'
import { getDataLifecycleSnapshot, subscribeDataLifecycle } from '../lib/dataLifecycle'

export function useDataLifecycle() {
  return useSyncExternalStore(
    subscribeDataLifecycle,
    getDataLifecycleSnapshot,
    getDataLifecycleSnapshot,
  )
}
