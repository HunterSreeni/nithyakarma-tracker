import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { track } from '../utils/analytics'
import { buildChart, RASIS, NAKSHATRAS } from '../lib/jadhagam/chart'
import { birthDetailsToUtc as toUtc } from '../lib/jadhagam/time'
import { loadCharts, saveChart, deleteChart, newChartId } from '../lib/jadhagam/storage'
import ChartForm from './jadhagam/ChartForm'
import ChartView, { DisclaimerLine } from './jadhagam/ChartView'

const RELATION = { self: 'You', family: 'Family member', other: 'Other' }

function chartSummary(c) {
  try {
    const chart = buildChart({ utc: toUtc(c), lat: c.place.lat, lon: c.place.lon })
    return `${NAKSHATRAS[chart.star.nakshatra].en} ${chart.star.pada} - ${RASIS[chart.star.rasi].en} rasi - ${RASIS[chart.lagna].en} lagna`
  } catch { return '' }
}

// Back within the app when there is somewhere to go back to, else to Profile
// (where the Jadhagam entry lives), never out of the app.
function useGoBack() {
  const navigate = useNavigate()
  return () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/profile', { replace: true }))
}

function BackBar({ to, label }) {
  const navigate = useNavigate()
  const goBack = useGoBack()
  return (
    <div className="legal-head">
      <button className="legal-back" onClick={() => (to ? navigate(to) : goBack())} aria-label={label}>
        <ChevronLeft size={16} strokeWidth={2.5} /> {label}
      </button>
    </div>
  )
}

function ChartList({ charts }) {
  return (
    <>
      <BackBar label="Back" />
      <h1 className="legal-title">Jadhagam <span className="bc-ta">ஜாதகம்</span></h1>
      <p className="greet-sub bc-list-sub">Saved only on this phone. Never sent to Nithyakarma.</p>
      <DisclaimerLine />
      <ul className="bc-list">
        {charts.map((c) => (
          <li key={c.id}>
            <Link to={`/birth-chart/${c.id}`} className="card bc-list-item">
              <span className="bc-avatar" aria-hidden="true">{c.name.slice(0, 1).toUpperCase()}</span>
              <span className="bc-list-text">
                <span className="bc-entry-title">{c.name} <span className="greet-sub">({RELATION[c.relation] ?? 'Other'})</span></span>
                <span className="greet-sub">{chartSummary(c)}</span>
              </span>
              <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/birth-chart/new" className="btn-primary bc-new"><Plus size={16} strokeWidth={2.5} aria-hidden="true" /> New chart</Link>
      <p className="greet-sub bc-privacy">Make charts for yourself, your family or anyone else. Only add someone else's birth details with their permission.</p>
    </>
  )
}

function ChartRoute({ charts }) {
  const { chartId } = useParams()
  const details = charts.find((c) => c.id === chartId)
  if (!details) return <Navigate to="/birth-chart" replace />
  return (
    <>
      <BackBar to="/birth-chart" label="All charts" />
      <ChartView key={details.id} details={details} />
    </>
  )
}

function FormRoute({ charts, selfName, familyMembers, onSave, onDelete }) {
  const { chartId } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const initial = chartId ? charts.find((c) => c.id === chartId) : null
  if (chartId && !initial) return <Navigate to="/birth-chart" replace />
  // The first chart someone makes is usually their own; later ones usually are not.
  const firstChart = charts.length === 0
  return (
    <>
      <BackBar label="Back" />
      <h1 className="legal-title">{initial ? 'Edit chart' : 'New chart'}</h1>
      <ChartForm
        key={chartId ?? 'new'}
        initial={initial}
        defaultWhose={firstChart ? 'self' : 'other'}
        selfName={selfName}
        familyMembers={familyMembers}
        onSave={async (d) => { const id = await onSave(d); navigate(`/birth-chart/${id}`, { replace: true }) }}
        onCancel={goBack}
        onDelete={initial ? async () => { await onDelete(initial.id); navigate('/birth-chart', { replace: true }) } : null}
      />
    </>
  )
}

export default function BirthChartPage() {
  const { session, profile, familyMembers } = useAuth()
  const userId = session.user.id
  const selfName = profile?.display_name ?? ''
  const [charts, setCharts] = useState(undefined) // undefined = loading
  const { pathname } = useLocation()

  // Each chart screen opens at the top; the WebView keeps the old scroll otherwise.
  useEffect(() => { try { window.scrollTo(0, 0) } catch { /* not available */ } }, [pathname])

  useEffect(() => {
    let live = true
    loadCharts(userId, { selfName }).then((list) => { if (live) setCharts(list) })
    return () => { live = false }
    // selfName only names a migrated v1 chart once; a later rename must not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // One view per visit, not one per chart or edit.
  const tracked = useRef(false)
  useEffect(() => {
    if (charts?.length && !tracked.current) { tracked.current = true; track('birth_chart_viewed') }
  }, [charts])

  const save = async (d) => {
    const chart = { ...d, id: d.id ?? newChartId() }
    try { setCharts(await saveChart(userId, chart, { selfName })) } catch {
      // Still show the chart for this visit; it just will not be remembered.
      setCharts((list) => [...(list ?? []).filter((c) => c.id !== chart.id), chart])
    }
    return chart.id
  }
  const remove = async (id) => {
    try { setCharts(await deleteChart(userId, id)) } catch { setCharts((list) => list.filter((c) => c.id !== id)) }
  }

  if (charts === undefined) return <div className="bc-page" />
  const formProps = { charts, selfName, familyMembers: familyMembers ?? [], onSave: save, onDelete: remove }

  return (
    <div className="bc-page">
      <Routes>
        <Route index element={charts.length ? <ChartList charts={charts} /> : <Navigate to="new" replace />} />
        <Route path="new" element={<FormRoute {...formProps} />} />
        <Route path=":chartId" element={<ChartRoute charts={charts} />} />
        <Route path=":chartId/edit" element={<FormRoute {...formProps} />} />
      </Routes>
    </div>
  )
}
