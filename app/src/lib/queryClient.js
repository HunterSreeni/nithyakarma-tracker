import { QueryClient } from '@tanstack/react-query'

export const DATA_DEADLINE_MS = 15000

function deadlineError(label, timeoutMs) {
  const error = new Error(`${label} timed out after ${timeoutMs}ms`)
  error.name = 'TimeoutError'
  return error
}

// This bounds the whole Supabase operation, including time spent waiting for
// auth-js's session lock before a network request is created. The custom fetch
// timeout in supabase.js cannot cover that part of the request lifecycle.
export function withDeadline(operation, label = 'Request', timeoutMs = DATA_DEADLINE_MS) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(deadlineError(label, timeoutMs)), timeoutMs)
  })
  return Promise.race([Promise.resolve(operation), timeout]).finally(() => clearTimeout(timer))
}

export function unwrap(result) {
  if (result?.error) throw result.error
  return result?.data
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      retry: 1,
      retryDelay: attempt => Math.min(100 * (attempt + 1), 1000),
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
})
