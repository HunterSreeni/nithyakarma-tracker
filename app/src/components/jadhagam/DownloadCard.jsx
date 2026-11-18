import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../../hooks/useAuth'
import { track } from '../../utils/analytics'
import { showRewardedVideo } from '../../utils/ads'
import { friendlyError } from '../../utils/friendlyError'
import { downloadStatus, claimDownload, startReward, canDownloadNow, waitForVideoCredit } from '../../lib/jadhagam/download'
import { renderJpg, renderPdf, deliver, fileName } from '../../lib/jadhagam/exportFile'
import { ExportLayouts } from './ExportLayouts'

const KINDS = { jpg: 'chart image (JPG)', pdf: 'full jadhagam (PDF)' }
const dateLabel = (iso) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '')
// Closing the share sheet is not a failure: the file was built and saved.
const cancelled = (err) => /cancel/i.test(String(err?.message ?? err))

// AI-DEV NOTE: order matters. Build the file first, then claim it on the server,
// then hand it over, so a failed build never uses up the free download. Only
// Google's SSV callback (admob-ssv) can create a video credit; the app's own
// "rewarded" event just starts polling for it.
export default function DownloadCard({ details, chart, timeline, utc }) {
  const { session } = useAuth()
  const native = Capacitor.isNativePlatform()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(null) // 'jpg' | 'pdf' | null
  const [rendering, setRendering] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [message, setMessage] = useState(null)
  const layoutsRef = useRef(null)
  const renderedRef = useRef(null)

  const refresh = useCallback(() => downloadStatus().then(setStatus).catch(() => {}), [])
  useEffect(() => { refresh() }, [refresh])

  // Mount the off-screen layout for this kind, wait for it to paint, return its pages.
  const pages = (kind) => new Promise((resolve) => {
    renderedRef.current = resolve
    setRendering(kind)
  })
  useEffect(() => {
    if (!rendering || !renderedRef.current) return
    const nodes = [...(layoutsRef.current?.querySelectorAll('[data-export-page]') ?? [])]
    renderedRef.current(nodes)
    renderedRef.current = null
  }, [rendering])

  const buildAndSave = async (kind) => {
    const nodes = await pages(kind)
    try {
      const dataUrl = kind === 'jpg' ? await renderJpg(nodes[0]) : await renderPdf(nodes)
      const res = await claimDownload(kind)
      if (!res?.allowed) { await refresh(); setSheet(kind); return }
      track('jadhagam_download', { kind, via: res.via })
      try { await deliver(dataUrl, fileName(details.name, kind)) } catch (err) { if (!cancelled(err)) throw err }
      setMessage({ tone: 'ok', text: `Your ${KINDS[kind]} is ready.` })
      refresh()
    } finally {
      setRendering(null)
    }
  }

  const download = async (kind) => {
    if (busy) return
    setBusy(kind); setMessage(null)
    try {
      const s = await downloadStatus()
      setStatus(s)
      if (canDownloadNow(s)) await buildAndSave(kind)
      else setSheet(kind)
    } catch (err) {
      setMessage({ tone: 'error', text: friendlyError(err) })
    } finally {
      setBusy(null)
    }
  }

  const watchVideo = async (kind) => {
    setSheet(null); setBusy(kind); setMessage(null)
    try {
      const grantId = await startReward()
      const outcome = await showRewardedVideo({ userId: session.user.id, grantId })
      if (outcome === 'dismissed') { setMessage({ tone: 'error', text: 'The video was closed before the end, so nothing was downloaded.' }); return }
      if (outcome !== 'rewarded') { setMessage({ tone: 'error', text: 'No video is available right now. Try again in a little while.' }); return }
      setMessage({ tone: 'info', text: 'Checking the video with Google...' })
      if (!(await waitForVideoCredit())) {
        setMessage({ tone: 'error', text: 'Google has not confirmed the video yet. Tap download again in a minute; the video still counts.' })
        refresh()
        return
      }
      setMessage(null)
      await buildAndSave(kind)
    } catch (err) {
      setMessage({ tone: 'error', text: friendlyError(err) })
    } finally {
      setBusy(null)
    }
  }

  const chip = !status ? null
    : status.ad_free ? { cls: 'adfree', text: 'Ad-free: unlimited' }
      : status.free_left > 0 ? { cls: 'free', text: '1 free this month' }
        : status.video_credits > 0 ? { cls: 'free', text: `${status.video_credits} ready from a video` }
          : { cls: 'used', text: 'Free one used' }
  const rule = !status ? 'One download a month is free, either button.'
    : status.ad_free ? `Your ad-free time from a referral covers downloads too, until ${dateLabel(status.ad_free_until)}.`
      : status.free_left > 0 ? 'One download a month is free, either button. After that, watch a short video for each download.'
        : `You have used this month's free download. Each extra download plays a short video first. Next free one: ${dateLabel(status.next_free)}.`

  return (
    <section className="card bc-dl" aria-labelledby="bc-dl-h">
      <div className="bc-dl-top">
        <h2 className="card-h" id="bc-dl-h">Download</h2>
        {chip && <span className={`bc-dl-chip ${chip.cls}`}>{chip.text}</span>}
      </div>
      <div className="bc-dl-btns">
        <button type="button" className="bc-dl-btn" disabled={!!busy} onClick={() => download('jpg')}>
          <b>{busy === 'jpg' ? 'Preparing...' : 'Chart image'}</b><span>JPG, chart + details</span>
        </button>
        <button type="button" className="bc-dl-btn primary" disabled={!!busy} onClick={() => download('pdf')}>
          <b>{busy === 'pdf' ? 'Preparing...' : 'Full jadhagam'}</b><span>PDF, all pages</span>
        </button>
      </div>
      <p className="greet-sub">{rule}</p>
      {message && <p className={`bc-dl-msg ${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>}

      {sheet && (
        <div className="bc-sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="bc-sheet" role="dialog" aria-modal="true" aria-labelledby="bc-sheet-h" onClick={(e) => e.stopPropagation()}>
            <h2 id="bc-sheet-h">This month's free download is used</h2>
            {native ? (
              <>
                <p>Watch a short video to download your <b>{KINDS[sheet]}</b>. You get one free download every month; the next one is on {dateLabel(status?.next_free)}.</p>
                <button type="button" className="btn-primary bc-sheet-main" onClick={() => watchVideo(sheet)}>Watch video and download</button>
              </>
            ) : (
              <p>On the web you get the one free download a month. Download more in the Nithyakarma app, where a short video unlocks each extra download. Next free one here: {dateLabel(status?.next_free)}.</p>
            )}
            <button type="button" className="btn-secondary bc-sheet-close" onClick={() => setSheet(null)}>Not now</button>
            <p className="greet-sub">Ad-free from a referral? Downloads are always free while it lasts.</p>
          </div>
        </div>
      )}

      {rendering && <ExportLayouts ref={layoutsRef} kind={rendering} details={details} chart={chart} timeline={timeline} utc={utc} />}
    </section>
  )
}
