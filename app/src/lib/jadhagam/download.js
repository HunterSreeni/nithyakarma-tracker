// Jadhagam download allowance, decided on the server (migration
// 20261118100000_jadhagam_downloads.sql): one free download a month, ad-free
// users always free, extra downloads after a rewarded video that Google confirms
// server-side (edge function admob-ssv).
// AI-DEV NOTE: only the download kind ("jpg"/"pdf") is ever sent. Birth details
// stay on this phone; the files are built here.
import { supabase } from '../supabase'

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}

// { ad_free, ad_free_until, free_left, video_credits, next_free }
export const downloadStatus = () => rpc('jadhagam_download_status')

// Records one download after the file is built. { allowed, via } or { allowed: false, reason }.
export const claimDownload = (kind) => rpc('claim_jadhagam_download', { p_kind: kind })

// A pending grant id to pass to the rewarded ad as SSV custom_data.
export const startReward = () => rpc('start_jadhagam_reward')

export const canDownloadNow = (s) => !!s && (s.ad_free || s.free_left > 0 || s.video_credits > 0)

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// After a rewarded video, Google calls admob-ssv within a few seconds (and
// retries up to five times). Poll until that verified credit shows up.
export async function waitForVideoCredit({ timeoutMs = 30000, intervalMs = 1500, status = downloadStatus, sleep = wait } = {}) {
  const tries = Math.max(1, Math.ceil(timeoutMs / intervalMs))
  for (let i = 0; i < tries; i++) {
    const s = await status().catch(() => null)
    if (s?.video_credits > 0) return true
    await sleep(intervalMs)
  }
  return false
}
