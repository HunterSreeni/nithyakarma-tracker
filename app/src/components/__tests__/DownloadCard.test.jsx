import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import axe from 'axe-core'

const h = vi.hoisted(() => ({
  native: true, status: null, order: [],
  downloadStatus: vi.fn(), claimDownload: vi.fn(), startReward: vi.fn(), waitForVideoCredit: vi.fn(),
  renderJpg: vi.fn(), renderPdf: vi.fn(), deliver: vi.fn(), showRewardedVideo: vi.fn(), track: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => h.native } }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('../../utils/analytics', () => ({ track: (...a) => h.track(...a) }))
vi.mock('../../utils/ads', () => ({ showRewardedVideo: (...a) => h.showRewardedVideo(...a) }))
vi.mock('../../lib/jadhagam/download', async (orig) => ({
  canDownloadNow: (await orig()).canDownloadNow,
  downloadStatus: (...a) => h.downloadStatus(...a),
  claimDownload: (...a) => { h.order.push('claim'); return h.claimDownload(...a) },
  startReward: (...a) => h.startReward(...a),
  waitForVideoCredit: (...a) => h.waitForVideoCredit(...a),
}))
vi.mock('../../lib/jadhagam/exportFile', async (orig) => ({
  fileName: (await orig()).fileName,
  renderJpg: (...a) => { h.order.push('render'); return h.renderJpg(...a) },
  renderPdf: (...a) => { h.order.push('render'); return h.renderPdf(...a) },
  deliver: (...a) => { h.order.push('deliver'); return h.deliver(...a) },
}))

import DownloadCard from '../jadhagam/DownloadCard'
import { buildChart } from '../../lib/jadhagam/chart'
import { dasaTimeline } from '../../lib/jadhagam/dasa'

const place = { name: 'Thrissur', state: 'Kerala', lat: 10.517, lon: 76.217, tz: 'Asia/Kolkata' }
const details = { id: 'c1', name: 'Meera K', tradition: 'tamil', date: '1981-02-10', hour12: 9, minute: 15, ampm: 'AM', place, offsetOverride: '' }
const utc = new Date('1981-02-10T03:45:00Z')
const chart = buildChart({ utc, lat: place.lat, lon: place.lon })
const timeline = dasaTimeline(chart.moonLon, utc.getTime())
const STATUS = {
  free: { ad_free: false, free_left: 1, video_credits: 0, next_free: '2026-12-01' },
  used: { ad_free: false, free_left: 0, video_credits: 0, next_free: '2026-12-01' },
  adfree: { ad_free: true, ad_free_until: '2026-12-12', free_left: 1, video_credits: 0, next_free: '2026-12-01' },
}
const renderCard = () => render(<DownloadCard details={details} chart={chart} timeline={timeline} utc={utc} />)

beforeEach(() => {
  h.native = true; h.order = []
  for (const k of ['downloadStatus', 'claimDownload', 'startReward', 'waitForVideoCredit', 'renderJpg', 'renderPdf', 'deliver', 'showRewardedVideo', 'track']) h[k].mockReset()
  h.downloadStatus.mockImplementation(async () => h.status)
  h.renderJpg.mockResolvedValue('data:image/jpeg;base64,AAA')
  h.renderPdf.mockResolvedValue('data:application/pdf;base64,BBB')
  h.deliver.mockResolvedValue()
})

describe('DownloadCard', () => {
  it('shows the allowance from the server', async () => {
    h.status = STATUS.free
    const { unmount } = renderCard()
    expect(await screen.findByText('1 free this month')).toBeInTheDocument()
    unmount()
    h.status = STATUS.used
    const second = renderCard()
    expect(await screen.findByText('Free one used')).toBeInTheDocument()
    expect(screen.getByText(/Next free one: 1 Dec 2026/)).toBeInTheDocument()
    second.unmount()
    h.status = STATUS.adfree
    renderCard()
    expect(await screen.findByText('Ad-free: unlimited')).toBeInTheDocument()
  })

  it('builds the image first, then claims it, then hands it over', async () => {
    h.status = STATUS.free
    h.claimDownload.mockResolvedValue({ allowed: true, via: 'free' })
    renderCard()
    await screen.findByText('1 free this month')
    fireEvent.click(screen.getByRole('button', { name: /Chart image/ }))
    expect(await screen.findByText('Your chart image (JPG) is ready.')).toBeInTheDocument()
    expect(h.order).toEqual(['render', 'claim', 'deliver'])
    expect(h.claimDownload).toHaveBeenCalledWith('jpg')
    expect(h.deliver).toHaveBeenCalledWith('data:image/jpeg;base64,AAA', 'jadhagam-meera-k.jpg')
    expect(h.track).toHaveBeenCalledWith('jadhagam_download', { kind: 'jpg', via: 'free' })
    expect(h.showRewardedVideo).not.toHaveBeenCalled()
  })

  it('renders all three PDF pages', async () => {
    h.status = STATUS.adfree
    h.claimDownload.mockResolvedValue({ allowed: true, via: 'adfree' })
    renderCard()
    await screen.findByText('Ad-free: unlimited')
    fireEvent.click(screen.getByRole('button', { name: /Full jadhagam/ }))
    await screen.findByText('Your full jadhagam (PDF) is ready.')
    const nodes = h.renderPdf.mock.calls[0][0]
    expect(nodes).toHaveLength(3)
    expect(nodes[2].textContent).toMatch(/ASTROLOGY IS NOT SCIENCE/)
    expect(h.deliver).toHaveBeenCalledWith(expect.any(String), 'jadhagam-meera-k.pdf')
  })

  it('never uses a download when the file fails to build', async () => {
    h.status = STATUS.free
    h.renderJpg.mockRejectedValue(new Error('canvas blew up'))
    renderCard()
    await screen.findByText('1 free this month')
    fireEvent.click(screen.getByRole('button', { name: /Chart image/ }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(h.claimDownload).not.toHaveBeenCalled()
  })

  it('treats a cancelled share sheet as done', async () => {
    h.status = STATUS.free
    h.claimDownload.mockResolvedValue({ allowed: true, via: 'free' })
    h.deliver.mockRejectedValue(new Error('Share canceled'))
    renderCard()
    await screen.findByText('1 free this month')
    fireEvent.click(screen.getByRole('button', { name: /Chart image/ }))
    expect(await screen.findByText('Your chart image (JPG) is ready.')).toBeInTheDocument()
  })

  it('offers a video once the free one is used, and downloads after Google confirms it', async () => {
    h.status = STATUS.used
    h.startReward.mockResolvedValue('grant-1')
    h.showRewardedVideo.mockResolvedValue('rewarded')
    h.waitForVideoCredit.mockResolvedValue(true)
    h.claimDownload.mockResolvedValue({ allowed: true, via: 'rewarded' })
    renderCard()
    await screen.findByText('Free one used')
    fireEvent.click(screen.getByRole('button', { name: /Full jadhagam/ }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('full jadhagam (PDF)')
    expect(h.claimDownload).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Watch video and download' }))
    expect(await screen.findByText('Your full jadhagam (PDF) is ready.')).toBeInTheDocument()
    expect(h.showRewardedVideo).toHaveBeenCalledWith({ userId: 'u1', grantId: 'grant-1' })
    expect(h.order).toEqual(['render', 'claim', 'deliver'])
    expect(h.track).toHaveBeenCalledWith('jadhagam_download', { kind: 'pdf', via: 'rewarded' })
  })

  it('downloads nothing when the video is closed early or not confirmed', async () => {
    h.status = STATUS.used
    h.startReward.mockResolvedValue('grant-1')
    h.showRewardedVideo.mockResolvedValueOnce('dismissed')
    renderCard()
    await screen.findByText('Free one used')
    fireEvent.click(screen.getByRole('button', { name: /Chart image/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Watch video and download' }))
    expect(await screen.findByText(/closed before the end/)).toBeInTheDocument()

    h.showRewardedVideo.mockResolvedValueOnce('rewarded')
    h.waitForVideoCredit.mockResolvedValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: /Chart image/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Watch video and download' }))
    expect(await screen.findByText(/has not confirmed the video yet/)).toBeInTheDocument()
    expect(h.claimDownload).not.toHaveBeenCalled()
    expect(h.renderJpg).not.toHaveBeenCalled()
  })

  it('shows the sheet if the server refuses at claim time', async () => {
    h.status = STATUS.free
    h.claimDownload.mockResolvedValue({ allowed: false, reason: 'needs_video' })
    renderCard()
    await screen.findByText('1 free this month')
    fireEvent.click(screen.getByRole('button', { name: /Chart image/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(h.deliver).not.toHaveBeenCalled()
  })

  it('on the web, points to the app instead of offering a video', async () => {
    h.native = false
    h.status = STATUS.used
    renderCard()
    await screen.findByText('Free one used')
    fireEvent.click(screen.getByRole('button', { name: /Chart image/ }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Download more in the Nithyakarma app')
    expect(screen.queryByRole('button', { name: 'Watch video and download' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('has no serious accessibility violations, sheet open', async () => {
    h.status = STATUS.used
    const { container } = renderCard()
    await screen.findByText('Free one used')
    fireEvent.click(screen.getByRole('button', { name: /Chart image/ }))
    await screen.findByRole('dialog')
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
    expect(res.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => v.id)).toEqual([])
  })
})
