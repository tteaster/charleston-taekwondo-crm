import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

const today      = new Date().toISOString().slice(0, 10)
const nDaysAgo   = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const nMonthsAgo = n => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10) }
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

function fmt$(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
}

function fmtMonthLabel(ym) {
  return new Date(ym + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function getMonthsInRange(start, end) {
  const months = []
  const s = new Date(start.slice(0, 7) + '-01T00:00:00')
  const e = new Date(end.slice(0, 7)   + '-01T00:00:00')
  const c = new Date(s)
  while (c <= e) { months.push(c.toISOString().slice(0, 7)); c.setMonth(c.getMonth() + 1) }
  return months
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return d.toISOString().slice(0, 10)
}

function getWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function projectRevenue(price, cycle, days) {
  if (cycle === 'weekly')   return price * (days / 7)
  if (cycle === 'biweekly') return price * (days / 14)
  if (cycle === 'monthly')  return price * (days / 30.44)
  return 0
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inputCls = 'border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

function FilterBar({ children }) {
  return (
    <div className="flex flex-wrap gap-3 items-center p-4 bg-slate-50 rounded-xl border border-slate-200 mb-5">
      {children}
    </div>
  )
}

function RunButton({ onClick, loading }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
      {loading ? 'Loading…' : 'Run Report'}
    </button>
  )
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-0.5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function Empty({ msg = 'No data for this period.' }) {
  return <p className="text-sm text-slate-400 text-center py-12 italic">{msg}</p>
}

// ── Vertical Grouped Bar Chart ────────────────────────────────────────────────

function BarChart({ data, keyMap, maxHeight = 120 }) {
  if (!data.length) return <Empty />
  const keys   = Object.keys(keyMap)
  const maxVal = Math.max(...data.flatMap(d => keys.map(k => d[k] ?? 0)), 1)
  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="flex items-end gap-2 min-w-max">
          {data.map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5" style={{ minWidth: `${keys.length * 14 + 16}px` }}>
              <div className="flex items-end gap-1">
                {keys.map(k => {
                  const v = item[k] ?? 0
                  const h = v > 0 ? Math.max((v / maxVal) * maxHeight, 4) : 0
                  return (
                    <div key={k} title={`${keyMap[k].label}: ${v}`}
                      className={`w-4 rounded-t-sm ${keyMap[k].color} transition-all`}
                      style={{ height: `${h}px` }} />
                  )
                })}
              </div>
              <p className="text-xs text-slate-400 whitespace-nowrap">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-100">
        {keys.map(k => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${keyMap[k].color}`} />
            <span className="text-xs text-slate-500">{keyMap[k].label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Horizontal bar (for funnel) ───────────────────────────────────────────────

function FunnelBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-right text-sm font-medium text-slate-600 shrink-0">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-8 overflow-hidden">
        <div className={`h-full rounded-full ${color} flex items-center px-3 transition-all`}
          style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%`, minWidth: count > 0 ? '2rem' : '0' }}>
          {count > 0 && <span className="text-xs text-white font-semibold">{count}</span>}
        </div>
      </div>
      <div className="w-16 text-xs text-slate-500 text-right shrink-0">{pct.toFixed(1)}%</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. REVENUE REPORT
// ─────────────────────────────────────────────────────────────────────────────

function RevenueTab({ locations, scopedLocationId }) {
  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate,   setEndDate]   = useState(today)
  const [locFilter, setLocFilter] = useState('all')
  const [rows,      setRows]      = useState([])
  const [loading,   setLoading]   = useState(false)
  const [hasRun,    setHasRun]    = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const days = Math.max((new Date(endDate) - new Date(startDate)) / 86400000 + 1, 1)

    const [payRes, membRes] = await Promise.all([
      supabase.from('payments')
        .select('amount, students(location_id, locations(id, name))')
        .eq('status', 'paid')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate),
      supabase.from('student_memberships')
        .select('membership_types(price, billing_cycle), students(location_id, locations(id, name))')
        .eq('status', 'active'),
    ])

    const actual = {}
    ;(payRes.data ?? []).forEach(p => {
      const s = p.students; if (!s) return
      if (scopedLocationId && s.location_id !== scopedLocationId) return
      if (!scopedLocationId && locFilter !== 'all' && s.location_id !== locFilter) return
      const id = s.location_id ?? 'unknown'
      if (!actual[id]) actual[id] = { name: s.locations?.name ?? 'Unknown', id, amount: 0 }
      actual[id].amount += parseFloat(p.amount) || 0
    })

    const projected = {}
    ;(membRes.data ?? []).forEach(m => {
      const s = m.students; const t = m.membership_types; if (!s || !t) return
      if (scopedLocationId && s.location_id !== scopedLocationId) return
      if (!scopedLocationId && locFilter !== 'all' && s.location_id !== locFilter) return
      const id = s.location_id ?? 'unknown'
      if (!projected[id]) projected[id] = { name: s.locations?.name ?? 'Unknown', id, amount: 0 }
      projected[id].amount += projectRevenue(parseFloat(t.price) || 0, t.billing_cycle, days)
    })

    const allIds = new Set([...Object.keys(actual), ...Object.keys(projected)])
    const result = Array.from(allIds).map(id => ({
      id,
      name:      actual[id]?.name ?? projected[id]?.name ?? '—',
      actual:    actual[id]?.amount ?? 0,
      projected: projected[id]?.amount ?? 0,
    })).sort((a, b) => a.name.localeCompare(b.name))

    setRows(result)
    setLoading(false)
    setHasRun(true)
  }, [startDate, endDate, locFilter, scopedLocationId])

  const totalActual    = rows.reduce((s, r) => s + r.actual, 0)
  const totalProjected = rows.reduce((s, r) => s + r.projected, 0)

  return (
    <div>
      <FilterBar>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        <span className="text-slate-400">→</span>
        <input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   className={inputCls} />
        {!scopedLocationId && (
          <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className={inputCls}>
            <option value="all">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <RunButton onClick={run} loading={loading} />
      </FilterBar>

      {!hasRun && <Empty msg="Select a date range and click Run Report." />}

      {hasRun && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <StatCard label="Actual Revenue"     value={fmt$(totalActual)}    accent="text-emerald-600" />
            <StatCard label="Projected Revenue"  value={fmt$(totalProjected)} accent="text-indigo-600" />
            <StatCard label="Difference"
              value={fmt$(totalActual - totalProjected)}
              accent={totalActual >= totalProjected ? 'text-emerald-600' : 'text-rose-600'}
              sub={totalProjected > 0 ? `${((totalActual / totalProjected) * 100).toFixed(1)}% of projection` : ''} />
          </div>

          {rows.length === 0 ? <Empty msg="No revenue data for this period." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Location', 'Actual Revenue', 'Projected Revenue', 'Difference', '% of Projection'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(r => {
                    const diff = r.actual - r.projected
                    const pct  = r.projected > 0 ? (r.actual / r.projected) * 100 : null
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">{fmt$(r.actual)}</td>
                        <td className="px-4 py-3 text-indigo-600">{fmt$(r.projected)}</td>
                        <td className={`px-4 py-3 font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {diff >= 0 ? '+' : ''}{fmt$(diff)}
                        </td>
                        <td className={`px-4 py-3 font-medium ${pct == null ? 'text-slate-400' : pct >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {pct != null ? `${pct.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                    <td className="px-4 py-3 text-slate-700">Total</td>
                    <td className="px-4 py-3 text-emerald-700">{fmt$(totalActual)}</td>
                    <td className="px-4 py-3 text-indigo-600">{fmt$(totalProjected)}</td>
                    <td className={`px-4 py-3 ${totalActual - totalProjected >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {totalActual - totalProjected >= 0 ? '+' : ''}{fmt$(totalActual - totalProjected)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {totalProjected > 0 ? `${((totalActual / totalProjected) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-3 italic">
            Projected is based on currently active memberships × billing periods in the selected range. Actual is payments with status "paid" recorded in Supabase.
          </p>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. STUDENT TRENDS
// ─────────────────────────────────────────────────────────────────────────────

function StudentTrendsTab({ locations, scopedLocationId }) {
  const [startDate, setStartDate] = useState(nMonthsAgo(6))
  const [endDate,   setEndDate]   = useState(today)
  const [locFilter, setLocFilter] = useState('all')
  const [chartData, setChartData] = useState([])
  const [summary,   setSummary]   = useState({ enrollments: 0, cancellations: 0, net: 0 })
  const [loading,   setLoading]   = useState(false)
  const [hasRun,    setHasRun]    = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('students').select('enrollment_date, cancellation_date, location_id')
    if (scopedLocationId) q = q.eq('location_id', scopedLocationId)
    else if (locFilter !== 'all') q = q.eq('location_id', locFilter)
    const { data } = await q

    const months = getMonthsInRange(startDate, endDate)
    const enroll = Object.fromEntries(months.map(m => [m, 0]))
    const cancel = Object.fromEntries(months.map(m => [m, 0]))

    ;(data ?? []).forEach(s => {
      const em = s.enrollment_date?.slice(0, 7)
      if (em && enroll[em] !== undefined) enroll[em]++
      const cm = s.cancellation_date?.slice(0, 7)
      if (cm && cancel[cm] !== undefined) cancel[cm]++
    })

    const chart = months.map(m => ({
      label:         fmtMonthLabel(m),
      enrollments:   enroll[m],
      cancellations: cancel[m],
      net:           enroll[m] - cancel[m],
    }))
    setChartData(chart)
    setSummary({
      enrollments:   chart.reduce((s, r) => s + r.enrollments,   0),
      cancellations: chart.reduce((s, r) => s + r.cancellations, 0),
      net:           chart.reduce((s, r) => s + r.net,           0),
    })
    setLoading(false)
    setHasRun(true)
  }, [startDate, endDate, locFilter, scopedLocationId])

  return (
    <div>
      <FilterBar>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        <span className="text-slate-400">→</span>
        <input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   className={inputCls} />
        {!scopedLocationId && (
          <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className={inputCls}>
            <option value="all">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <RunButton onClick={run} loading={loading} />
      </FilterBar>

      {!hasRun && <Empty msg="Select a date range and click Run Report." />}

      {hasRun && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="New Enrollments"  value={summary.enrollments}   accent="text-emerald-600" />
            <StatCard label="Cancellations"    value={summary.cancellations} accent="text-rose-600" />
            <StatCard label="Net Change"       value={(summary.net >= 0 ? '+' : '') + summary.net}
              accent={summary.net >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Enrollments vs Cancellations</h3>
            <BarChart data={chartData} keyMap={{
              enrollments:   { label: 'Enrollments',   color: 'bg-emerald-400' },
              cancellations: { label: 'Cancellations', color: 'bg-rose-400'    },
            }} />
          </div>

          {chartData.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Month', 'Enrollments', 'Cancellations', 'Net'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chartData.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-700">{r.label}</td>
                      <td className="px-4 py-2 text-emerald-600 font-medium">{r.enrollments}</td>
                      <td className="px-4 py-2 text-rose-600 font-medium">{r.cancellations}</td>
                      <td className={`px-4 py-2 font-semibold ${r.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {r.net >= 0 ? '+' : ''}{r.net}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LEAD CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

const LEAD_STAGES = [
  { key: 'new',             label: 'New',             color: 'bg-slate-500'   },
  { key: 'contacted',       label: 'Contacted',       color: 'bg-blue-500'    },
  { key: 'trial_scheduled', label: 'Trial Scheduled', color: 'bg-amber-500'   },
  { key: 'trial_completed', label: 'Trial Completed', color: 'bg-orange-500'  },
  { key: 'converted',       label: 'Converted',       color: 'bg-emerald-500' },
  { key: 'lost',            label: 'Lost',            color: 'bg-rose-500'    },
]

function LeadConversionTab({ locations, scopedLocationId }) {
  const [startDate, setStartDate] = useState(nMonthsAgo(3))
  const [endDate,   setEndDate]   = useState(today)
  const [locFilter, setLocFilter] = useState('all')
  const [counts,    setCounts]    = useState({})
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(false)
  const [hasRun,    setHasRun]    = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('leads').select('status, location_id')
      .gte('created_at', startDate + 'T00:00:00')
      .lte('created_at', endDate   + 'T23:59:59')
    if (scopedLocationId) q = q.eq('location_id', scopedLocationId)
    else if (locFilter !== 'all') q = q.eq('location_id', locFilter)
    const { data } = await q

    const c = {}
    LEAD_STAGES.forEach(s => { c[s.key] = 0 })
    ;(data ?? []).forEach(l => { if (c[l.status] !== undefined) c[l.status]++ })
    setCounts(c)
    setTotal((data ?? []).length)
    setLoading(false)
    setHasRun(true)
  }, [startDate, endDate, locFilter, scopedLocationId])

  const convRate = total > 0 ? ((counts.converted ?? 0) / total * 100).toFixed(1) : '0.0'

  return (
    <div>
      <FilterBar>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        <span className="text-slate-400">→</span>
        <input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   className={inputCls} />
        {!scopedLocationId && (
          <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className={inputCls}>
            <option value="all">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <RunButton onClick={run} loading={loading} />
      </FilterBar>

      {!hasRun && <Empty msg="Select a date range and click Run Report." />}

      {hasRun && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Leads"      value={total}              />
            <StatCard label="Converted"        value={counts.converted ?? 0} accent="text-emerald-600" />
            <StatCard label="Lost"             value={counts.lost ?? 0}      accent="text-rose-600" />
            <StatCard label="Conversion Rate"  value={`${convRate}%`}
              accent={parseFloat(convRate) >= 20 ? 'text-emerald-600' : parseFloat(convRate) >= 10 ? 'text-amber-600' : 'text-rose-600'} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-5">Pipeline by Stage</h3>
            {total === 0 ? <Empty msg="No leads in this period." /> : (
              <div className="space-y-3">
                {LEAD_STAGES.map(s => (
                  <FunnelBar key={s.key} label={s.label} count={counts[s.key] ?? 0} total={total} color={s.color} />
                ))}
              </div>
            )}
          </div>

          {total > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Stage', 'Count', '% of Total Leads'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {LEAD_STAGES.map(s => (
                    <tr key={s.key} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-700">{s.label}</td>
                      <td className="px-4 py-2 font-semibold text-slate-700">{counts[s.key] ?? 0}</td>
                      <td className="px-4 py-2 text-slate-500">
                        {total > 0 ? `${((counts[s.key] ?? 0) / total * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ATTENDANCE TRENDS
// ─────────────────────────────────────────────────────────────────────────────

function AttendanceTrendsTab({ locations, scopedLocationId }) {
  const [startDate, setStartDate] = useState(nDaysAgo(28))
  const [endDate,   setEndDate]   = useState(today)
  const [locFilter, setLocFilter] = useState('all')
  const [chartData, setChartData] = useState([])
  const [summary,   setSummary]   = useState({ total: 0, martial: 0, afterschool: 0 })
  const [loading,   setLoading]   = useState(false)
  const [hasRun,    setHasRun]    = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('attendance').select('class_date, class_type, location_id')
      .gte('class_date', startDate).lte('class_date', endDate)
    if (scopedLocationId) q = q.eq('location_id', scopedLocationId)
    else if (locFilter !== 'all') q = q.eq('location_id', locFilter)
    const { data } = await q

    const weeks = {}
    ;(data ?? []).forEach(a => {
      const wk  = getWeekKey(a.class_date)
      const lbl = getWeekLabel(a.class_date)
      if (!weeks[wk]) weeks[wk] = { label: lbl, martial_arts: 0, afterschool: 0 }
      if (a.class_type === 'TKD') weeks[wk].martial_arts++
      else if (a.class_type === 'ASP') weeks[wk].afterschool++
    })

    const chart = Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)
    setChartData(chart)
    const total     = (data ?? []).length
    const martial   = (data ?? []).filter(a => a.class_type === 'TKD').length
    const aftsch    = (data ?? []).filter(a => a.class_type === 'ASP').length
    setSummary({ total, martial, afterschool: aftsch })
    setLoading(false)
    setHasRun(true)
  }, [startDate, endDate, locFilter, scopedLocationId])

  return (
    <div>
      <FilterBar>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        <span className="text-slate-400">→</span>
        <input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   className={inputCls} />
        {!scopedLocationId && (
          <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className={inputCls}>
            <option value="all">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <RunButton onClick={run} loading={loading} />
      </FilterBar>

      {!hasRun && <Empty msg="Select a date range and click Run Report." />}

      {hasRun && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Check-ins"     value={summary.total}       />
            <StatCard label="Martial Arts (TKD)"  value={summary.martial}     accent="text-indigo-600" />
            <StatCard label="After School (ASP)"  value={summary.afterschool} accent="text-teal-600" />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Weekly Check-ins by Program</h3>
            <BarChart data={chartData} keyMap={{
              martial_arts: { label: 'Martial Arts', color: 'bg-indigo-400' },
              afterschool:  { label: 'After School', color: 'bg-teal-400'   },
            }} />
          </div>

          {chartData.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Week of', 'Martial Arts', 'After School', 'Total'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chartData.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-700">{r.label}</td>
                      <td className="px-4 py-2 text-indigo-600 font-medium">{r.martial_arts}</td>
                      <td className="px-4 py-2 text-teal-600 font-medium">{r.afterschool}</td>
                      <td className="px-4 py-2 font-semibold text-slate-700">{r.martial_arts + r.afterschool}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MEMBERSHIP BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────────

const CYCLE_MONTHLY = { weekly: 4.333, biweekly: 2.167, monthly: 1 }
const CYCLE_LABEL   = { weekly: '/wk', biweekly: '/2wk', monthly: '/mo' }
const CAT_LABEL     = { afterschool: 'After School', martial_arts: 'Martial Arts', leadership: 'Leadership' }

function getProgram(name) {
  if (name.startsWith('Tigers'))      return 'Tigers'
  if (name.startsWith('Kids'))        return 'Kids'
  if (name.startsWith('Teen'))        return 'Teen/Adult'
  if (name.startsWith('Afterschool')) return 'Afterschool'
  if (name.startsWith('Leadership'))  return 'Leadership'
  return '—'
}

function MembershipBreakdownTab({ locations, scopedLocationId }) {
  const [locFilter, setLocFilter] = useState('all')
  const [rows,      setRows]      = useState([])
  const [loading,   setLoading]   = useState(false)
  const [hasRun,    setHasRun]    = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const [typesRes, membRes] = await Promise.all([
      supabase.from('membership_types').select('*').eq('active', true).order('category').order('name'),
      supabase.from('student_memberships')
        .select('membership_type_id, students(location_id)')
        .eq('status', 'active'),
    ])

    const effectiveLoc = scopedLocationId ?? (locFilter !== 'all' ? locFilter : null)
    const active = (membRes.data ?? []).filter(m =>
      !effectiveLoc || m.students?.location_id === effectiveLoc
    )

    const countMap = {}
    active.forEach(m => { countMap[m.membership_type_id] = (countMap[m.membership_type_id] ?? 0) + 1 })

    const result = (typesRes.data ?? []).map(t => ({
      ...t,
      activeCount: countMap[t.id] ?? 0,
      weeklyRev:   (countMap[t.id] ?? 0) * t.price * (CYCLE_MONTHLY[t.billing_cycle] ?? 1) / (CYCLE_MONTHLY[t.billing_cycle] ?? 1) * (t.billing_cycle === 'monthly' ? (1/4.333) : 1),
      monthlyRev:  (countMap[t.id] ?? 0) * t.price * (CYCLE_MONTHLY[t.billing_cycle] ?? 1),
    }))
    setRows(result)
    setLoading(false)
    setHasRun(true)
  }, [locFilter, scopedLocationId])

  // Simpler revenue calculation
  const calcRevs = (t) => {
    const c = t.activeCount
    const p = parseFloat(t.price)
    const weekly  = t.billing_cycle === 'weekly'   ? c * p
                  : t.billing_cycle === 'biweekly'  ? c * p / 2
                  : c * p / 4.333  // monthly
    const monthly = t.billing_cycle === 'weekly'   ? c * p * 4.333
                  : t.billing_cycle === 'biweekly'  ? c * p * 2.167
                  : c * p
    return { weekly, monthly }
  }

  const totalActive  = rows.reduce((s, r) => s + r.activeCount, 0)
  const totalMonthly = rows.reduce((s, r) => s + calcRevs(r).monthly, 0)

  const grouped = {}
  rows.forEach(r => { if (!grouped[r.category]) grouped[r.category] = []; grouped[r.category].push(r) })

  return (
    <div>
      <FilterBar>
        {!scopedLocationId && (
          <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className={inputCls}>
            <option value="all">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <RunButton onClick={run} loading={loading} />
      </FilterBar>

      {!hasRun && <Empty msg="Click Run Report to view current membership breakdown." />}

      {hasRun && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <StatCard label="Active Memberships" value={totalActive}     accent="text-indigo-600" />
            <StatCard label="Est. Monthly Revenue" value={fmt$(totalMonthly)} accent="text-emerald-600" />
          </div>

          {['afterschool', 'martial_arts', 'leadership'].map(cat => {
            const catRows = grouped[cat] ?? []
            if (!catRows.length) return null
            const catMonthly = catRows.reduce((s, r) => s + calcRevs(r).monthly, 0)
            return (
              <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{CAT_LABEL[cat]}</h3>
                  <div className="text-xs text-slate-500 flex gap-4">
                    <span><strong className="text-slate-700">{catRows.reduce((s, r) => s + r.activeCount, 0)}</strong> active</span>
                    <span><strong className="text-emerald-600">{fmt$(catMonthly)}</strong>/mo est.</span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100">
                    <tr>
                      {['Membership', 'Program', 'Cycle', 'Price', 'Active', 'Est. Weekly', 'Est. Monthly'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {catRows.map(r => {
                      const { weekly, monthly } = calcRevs(r)
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-700">{r.name}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{getProgram(r.name)}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 capitalize">{r.billing_cycle}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-700">${r.price}{CYCLE_LABEL[r.billing_cycle]}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.activeCount > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                              {r.activeCount}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{weekly > 0 ? fmt$(weekly) : <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-emerald-600 font-medium">{monthly > 0 ? fmt$(monthly) : <span className="text-slate-300">—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'revenue',      label: 'Revenue' },
  { key: 'students',     label: 'Student Trends' },
  { key: 'leads',        label: 'Lead Conversion' },
  { key: 'attendance',   label: 'Attendance' },
  { key: 'memberships',  label: 'Memberships' },
]

export default function ReportsPage() {
  const { scopedLocationId } = useAuth()
  const [activeTab,  setActiveTab]  = useState('revenue')
  const [locations,  setLocations]  = useState([])

  useEffect(() => {
    supabase.from('locations').select('*').order('name').then(({ data }) => setLocations(data ?? []))
  }, [])

  const tabProps = { locations, scopedLocationId }

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-800">Reports</h2>
          <p className="text-xs text-slate-500">Select a report, set filters, and click Run Report</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === t.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'revenue'     && <RevenueTab           {...tabProps} />}
          {activeTab === 'students'    && <StudentTrendsTab      {...tabProps} />}
          {activeTab === 'leads'       && <LeadConversionTab     {...tabProps} />}
          {activeTab === 'attendance'  && <AttendanceTrendsTab   {...tabProps} />}
          {activeTab === 'memberships' && <MembershipBreakdownTab {...tabProps} />}
        </div>
      </div>
    </div>
  )
}
