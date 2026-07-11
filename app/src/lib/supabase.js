import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

// A build without .env inlines these as undefined, which otherwise fails deep
// inside createClient with a cryptic error and a blank screen on the device.
// Fail loudly and clearly instead - the message surfaces in the WebView console.
if (!url || !key) {
  throw new Error(
    'Supabase env missing: VITE_SUPABASE_URL / VITE_SUPABASE_KEY were not set at build time. ' +
    'The app was built without a .env file.',
  )
}

export const supabase = createClient(url, key)
