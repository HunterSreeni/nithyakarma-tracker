import { describe, it, expect, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../supabase', () => ({ supabase: { rpc } }))

import { canDownloadNow, waitForVideoCredit, claimDownload, downloadStatus, startReward } from '../download'
import { fileName, A4_PT, assertFits } from '../exportFile'

describe('download allowance', () => {
  it('allows a download when ad-free, a free one is left, or a video credit waits', () => {
    expect(canDownloadNow(null)).toBe(false)
    expect(canDownloadNow({ ad_free: true, free_left: 0, video_credits: 0 })).toBe(true)
    expect(canDownloadNow({ ad_free: false, free_left: 1, video_credits: 0 })).toBe(true)
    expect(canDownloadNow({ ad_free: false, free_left: 0, video_credits: 1 })).toBe(true)
    expect(canDownloadNow({ ad_free: false, free_left: 0, video_credits: 0 })).toBe(false)
  })

  it('sends only the kind to the server', async () => {
    rpc.mockResolvedValue({ data: { allowed: true, via: 'free' }, error: null })
    expect(await claimDownload('pdf')).toEqual({ allowed: true, via: 'free' })
    expect(rpc).toHaveBeenLastCalledWith('claim_jadhagam_download', { p_kind: 'pdf' })
    await downloadStatus()
    expect(rpc).toHaveBeenLastCalledWith('jadhagam_download_status', undefined)
    await startReward()
    expect(rpc).toHaveBeenLastCalledWith('start_jadhagam_reward', undefined)
    rpc.mockResolvedValue({ data: null, error: new Error('Not signed in') })
    await expect(claimDownload('jpg')).rejects.toThrow('Not signed in')
  })

  it('polls until Google confirms the video, or gives up', async () => {
    const sleep = vi.fn(async () => {})
    let calls = 0
    const status = async () => ({ video_credits: ++calls >= 3 ? 1 : 0 })
    expect(await waitForVideoCredit({ status, sleep, timeoutMs: 15000, intervalMs: 1500 })).toBe(true)
    expect(calls).toBe(3)
    const never = vi.fn(async () => { throw new Error('offline') })
    expect(await waitForVideoCredit({ status: never, sleep, timeoutMs: 3000, intervalMs: 1500 })).toBe(false)
    expect(never).toHaveBeenCalledTimes(2)
  })
})

describe('export files', () => {
  it('names files after the person, safely', () => {
    expect(fileName('Meera K', 'pdf')).toBe('jadhagam-meera-k.pdf')
    expect(fileName('  Sreeni / Test!! ', 'jpg')).toBe('jadhagam-sreeni-test.jpg')
    expect(fileName('மீரா', 'jpg')).toBe('jadhagam-chart.jpg')
    expect(fileName('', 'pdf')).toBe('jadhagam-chart.pdf')
    expect(fileName('a'.repeat(60), 'jpg')).toBe(`jadhagam-${'a'.repeat(40)}.jpg`)
  })

  it('refuses a page whose content overflows it', () => {
    const page = (scrollHeight, clientHeight) => ({ scrollHeight, clientHeight, scrollWidth: 100, clientWidth: 100 })
    expect(() => assertFits(page(1684, 1684))).not.toThrow()
    expect(() => assertFits(page(1900, 1684))).toThrow(/did not fit/)
  })

  it('uses A4 in points', () => {
    expect(A4_PT).toEqual({ w: 595.28, h: 841.89 })
  })
})
