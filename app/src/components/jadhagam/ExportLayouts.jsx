import { forwardRef, useMemo } from 'react'
import { RASIS, NAKSHATRAS, GRAHAS, formatDeg } from '../../lib/jadhagam/chart'
import { currentPeriod, formatYears } from '../../lib/jadhagam/dasa'
import { birthPanchangam, WEEKDAYS, TAMIL_MONTHS, MALAYALAM_MONTHS } from '../../lib/jadhagam/panchangam'
import { antarams, saturnNow, jupiterNow } from '../../lib/jadhagam/now'
import { formatBirthDate } from '../../lib/jadhagam/time'

// Short planet letters in the grid already carry the vakra mark (shortV below).
// Off-screen layouts captured into the downloads. Drawn at the output size
// (image 1080px wide, PDF pages = A4 at 2x) so capture needs no scaling; every
// size is in em off the root font-size. See lib/jadhagam/exportFile.js.

const GRAHA = Object.fromEntries(GRAHAS.map((g) => [g.key, g]))
const CELL = [[1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [3, 1], [2, 1], [1, 1]]
const DIGNITY = { exalted: 'Exalted', debilitated: 'Debilitated', own: 'Own sign' }
const monthYear = (ms) => new Date(ms).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
const dayFmt = (ms) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
const ORD = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`

function useExportData({ details, chart, timeline, utc }) {
  return useMemo(() => {
    const kerala = details.tradition === 'kerala'
    const native = (x) => (kerala ? x.ml : x.ta)
    const p = birthPanchangam(utc, details.place, details.tradition)
    const nowMs = Date.now()
    const now = currentPeriod(timeline, nowMs)
    const antaram = now ? antarams(now.bhukti).find((a) => nowMs >= a.start && nowMs < a.end) : null
    const month = kerala
      ? `${MALAYALAM_MONTHS[p.solar.month]} ${p.solar.day} (${RASIS[p.solar.month].ml} ${p.solar.day})`
      : `${TAMIL_MONTHS[p.solar.month].en} ${p.solar.day} (${TAMIL_MONTHS[p.solar.month].ta} ${p.solar.day})`
    return {
      kerala, native, p, now, antaram, month,
      star: NAKSHATRAS[chart.star.nakshatra],
      saturn: saturnNow(chart.star.rasi, nowMs),
      jupiter: jupiterNow(chart.star.rasi, nowMs),
      born: `${formatBirthDate(details.date)}, ${details.hour12}:${String(details.minute).padStart(2, '0')} ${details.ampm}`,
      madeOn: dayFmt(nowMs),
    }
  }, [details, chart, timeline, utc])
}

function Grid({ chart, field, caption, native, short }) {
  const byRasi = Array.from({ length: 12 }, () => [])
  for (const g of chart.grahas) byRasi[g[field]].push(g)
  return (
    <div className="bx-grid">
      {RASIS.map((r, i) => (
        <div key={r.en} className="bx-cell" style={{ gridRow: CELL[i][0], gridColumn: CELL[i][1] }}>
          <span className="bx-cell-rasi">{native(r)}</span>
          <span className="bx-cell-grahas">
            {byRasi[i].map((g) => <span key={g.key} className={g.key === 'Lagna' ? 'bx-lagna' : undefined}>{short(g)}</span>)}
          </span>
        </div>
      ))}
      <div className="bx-grid-title">{caption}</div>
    </div>
  )
}

function Footer({ madeOn, page }) {
  return (
    <div className="bx-footer">
      <span>Calculated, not a prediction. Lahiri ayanamsa, drik positions. Calculated on this phone.</span>
      <span>{page ? `${page} - ` : ''}Made with Nithyakarma on {madeOn}</span>
    </div>
  )
}

function Rows({ rows }) {
  return (
    <div className="bx-rows">
      {rows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
    </div>
  )
}

export const ExportLayouts = forwardRef(function ExportLayouts({ details, chart, timeline, utc, kind }, ref) {
  const d = useExportData({ details, chart, timeline, utc })
  const { kerala, native, p } = d
  const short = (g) => (kerala ? g.mlShort : g.short)
  const vakraMark = kerala ? '(വ)' : '(வ)'
  const shortV = (g) => `${short(g)}${g.vakra ? vakraMark : ''}`
  const titles = kerala ? { rasi: 'രാശി', amsam: 'നവാംശം', word: 'ജാതകം' } : { rasi: 'ராசி', amsam: 'அம்சம்', word: 'ஜாதகம்' }
  const grid = (field, caption) => <Grid chart={chart} field={field} caption={caption} native={native} short={shortV} />
  const nowLine = d.now ? `${GRAHA[d.now.md.lord].en} dasa, ${GRAHA[d.now.bhukti.lord].en} bhukti${d.antaram ? `, ${GRAHA[d.antaram.lord].en} antaram` : ''}` : ''

  return (
    <div className="bx-host" ref={ref} aria-hidden="true">
      {kind === 'jpg' && (
        <div className="bx-card" data-export-page>
          <div className="bx-card-head">
            <div>
              <div className="bx-eyebrow">Jadhagam {titles.word}</div>
              <div className="bx-name">{details.name}</div>
              <div className="bx-sub">{d.born} - {details.place.name}</div>
            </div>
            <Rows rows={[
              ['Star', `${native(d.star)} ${chart.star.pada}`],
              ['Rasi', native(RASIS[chart.star.rasi])],
              ['Lagna', native(RASIS[chart.lagna])],
              [kerala ? 'Malayalam date' : 'Tamil date', kerala ? `${RASIS[p.solar.month].ml} ${p.solar.day}` : `${TAMIL_MONTHS[p.solar.month].ta} ${p.solar.day}`],
            ]} />
          </div>
          <div className="bx-two">{grid('rasi', titles.rasi)}{grid('navamsa', titles.amsam)}</div>
          <div className="bx-tiles">
            <div><span>Dasa at birth</span><b>{GRAHA[timeline.balance.lord].en} {formatYears(timeline.balance.years)}</b></div>
            <div><span>Running now</span><b>{d.now ? `${GRAHA[d.now.md.lord].en} / ${GRAHA[d.now.bhukti.lord].en}` : '-'}</b></div>
            <div><span>Tithi</span><b>{p.tithi}</b></div>
          </div>
          <Footer madeOn={d.madeOn} />
        </div>
      )}

      {kind === 'pdf' && (
        <>
          <div className="bx-page" data-export-page>
            <div className="bx-page-head"><div><div className="bx-eyebrow">Jadhagam {titles.word}</div><div className="bx-name">{details.name}</div></div><span>Page 1 of 3</span></div>
            <h2 className="bx-h">Birth details</h2>
            <Rows rows={[
              ['Date', formatBirthDate(details.date)], ['Time', `${details.hour12}:${String(details.minute).padStart(2, '0')} ${details.ampm}`],
              ['Place', `${details.place.name}, ${details.place.state}`], ['Star', `${d.star.en} (${native(d.star)}), pada ${chart.star.pada}`],
              ['Rasi', `${RASIS[chart.star.rasi].en} (${native(RASIS[chart.star.rasi])})`], ['Lagna', `${RASIS[chart.lagna].en} (${native(RASIS[chart.lagna])})`],
              ['Dasa at birth', `${GRAHA[timeline.balance.lord].en} ${formatYears(timeline.balance.years)}`],
            ]} />
            <h2 className="bx-h">Birth-day panchangam</h2>
            <Rows rows={[
              ['Weekday', `${WEEKDAYS[p.weekday].en} (${native(WEEKDAYS[p.weekday])})`],
              kerala ? ['Kollam year', `ME ${p.kollamYear}`] : ['Tamil year', p.samvatsara],
              [kerala ? 'Malayalam month, date' : 'Tamil month, date', d.month],
              ['Paksha, tithi', p.tithi], ['Yogam', p.yoga], ['Karanam', p.karana],
              ['Born after sunrise', p.nazhigai ? `${p.nazhigai.nazhigai} nazhigai ${p.nazhigai.vinadi} vinadi` : '-'],
              ['Ayanamsa (Lahiri)', formatDeg(chart.ayanamsa)],
            ]} />
            <div className="bx-chart-row">{grid('rasi', titles.rasi)}<p className="bx-note">South Indian style: the signs stay fixed and Meenam is top-left. {short(GRAHA.Lagna)} marks the lagna, {vakraMark} a vakra (retrograde) planet.</p></div>
            <Footer madeOn={d.madeOn} />
          </div>

          <div className="bx-page" data-export-page>
            <div className="bx-page-head"><div className="bx-name bx-name-sm">{details.name} - planets and amsam</div><span>Page 2 of 3</span></div>
            <div className="bx-chart-row">
              {grid('navamsa', titles.amsam)}
              <div className="bx-note">
                <b>Now, on {d.madeOn}</b><br />{nowLine}<br />
                Saturn in the {ORD(d.saturn.house)} from the rasi{d.saturn.kind === 'ezharai' ? ` (Ezharai sani, phase ${d.saturn.phase})` : d.saturn.kind === 'ashtama' ? ' (Ashtama sani)' : d.saturn.kind === 'arthashtama' ? ' (Arthashtama sani)' : ''}<br />
                Guru in the {ORD(d.jupiter.house)} from the rasi
              </div>
            </div>
            <table className="bx-table">
              <thead><tr><th>Graha</th><th>Rasi</th><th>Degree</th><th>Star, pada</th><th>House</th><th>Notes</th></tr></thead>
              <tbody>
                {chart.grahas.map((g) => (
                  <tr key={g.key}>
                    <td><b>{g.en}</b> {native(g)}</td><td>{RASIS[g.rasi].en}</td><td>{formatDeg(g.degInRasi)}</td>
                    <td>{NAKSHATRAS[g.nakshatra].en} {g.pada}</td><td>{g.house}</td>
                    <td>{[g.vakra && 'Vakra', g.dignity && DIGNITY[g.dignity]].filter(Boolean).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Footer madeOn={d.madeOn} />
          </div>

          <div className="bx-page" data-export-page>
            <div className="bx-page-head"><div className="bx-name bx-name-sm">{details.name} - dasa periods</div><span>Page 3 of 3</span></div>
            <p className="bx-note">Vimshottari from birth, longitude method. Balance at birth: <b>{GRAHA[timeline.balance.lord].en} {formatYears(timeline.balance.years)}</b>.</p>
            <div className="bx-dasas">
              {timeline.periods.filter((x) => x.start < utc.getTime() + 100 * 365.25 * 86400000).map((x) => (
                <div key={x.start} className={d.now?.md === x ? 'bx-dasa on' : 'bx-dasa'}>
                  <div className="bx-dasa-head"><b>{GRAHA[x.lord].en} {native(GRAHA[x.lord])}</b><span>{monthYear(Math.max(x.start, utc.getTime()))} - {monthYear(x.end)}</span></div>
                  {x.bhuktis.filter((b) => b.end > utc.getTime()).map((b) => (
                    <div key={b.start} className="bx-bhukti"><span>{GRAHA[b.lord].en}</span><span>{monthYear(Math.max(b.start, utc.getTime()))} - {monthYear(b.end)}</span></div>
                  ))}
                </div>
              ))}
            </div>
            <div className="bx-disclaimer"><b>ASTROLOGY IS NOT SCIENCE.</b> This chart is calculated from the birth date, time and place entered, with the astronomy-engine ephemeris, Lahiri ayanamsa and Vimshottari dasa. Traditions differ, and your family astrologer may use other methods. Do not make marriage, health, money or legal decisions based on it.</div>
            <Footer madeOn={d.madeOn} />
          </div>
        </>
      )}
    </div>
  )
})

