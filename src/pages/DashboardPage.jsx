import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── inline chart helpers ────────────────────────────────────────────────────

function HBar({ label, value, max, colorClass }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-slate-600 w-36 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-6 text-right shrink-0">{value}</span>
    </div>
  )
}

function DonutSlice({ pct, offset, color }) {
  const r = 40
  const circ = 2 * Math.PI * r
  return (
    <circle
      cx="50" cy="50" r={r}
      fill="none"
      stroke={color}
      strokeWidth="18"
      strokeDasharray={`${(pct / 100) * circ} ${circ}`}
      strokeDashoffset={-offset * circ / 100}
      style={{ transition: 'stroke-dasharray 0.5s ease' }}
    />
  )
}

function DonutChart({ segments }) {
  let offset = 0
  const total = segments.reduce((s, x) => s + x.value, 0)
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
      {total === 0
        ? <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="18" />
        : segments.map((seg, i) => {
            const pct = (seg.value / total) * 100
            const el = <DonutSlice key={i} pct={pct} offset={offset} color={seg.color} />
            offset += pct
            return el
          })}
    </svg>
  )
}

// ── stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

// ── section card wrapper ────────────────────────────────────────────────────

function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ── constants ───────────────────────────────────────────────────────────────

const LEAD_STATUS_META = {
  new:             { label: 'New',             color: 'bg-slate-400',    hex: '#94a3b8' },
  contacted:       { label: 'Contacted',       color: 'bg-blue-400',     hex: '#60a5fa' },
  trial_scheduled: { label: 'Trial Scheduled', color: 'bg-amber-400',    hex: '#fbbf24' },
  trial_completed: { label: 'Trial Completed', color: 'bg-orange-400',   hex: '#fb923c' },
  converted:       { label: 'Converted',       color: 'bg-emerald-500',  hex: '#10b981' },
  lost:            { label: 'Lost',            color: 'bg-rose-400',     hex: '#fb7185' },
}

const PROGRAM_META = {
  tkd:     { label: 'Taekwondo (TKD)',  color: 'bg-indigo-400', hex: '#818cf8' },
  asp:     { label: 'After School',     color: 'bg-teal-400',   hex: '#2dd4bf' },
  tkd_asp: { label: 'TKD + ASP',        color: 'bg-violet-400', hex: '#c084fc' },
}

const SOURCE_LABELS = {
  walk_in: 'Walk-in', website: 'Website', facebook_ad: 'FB Ad',
  instagram_ad: 'IG Ad', referral: 'Referral', other: 'Other',
}

const SOURCE_COLORS = {
  walk_in: 'bg-teal-100 text-teal-700', website: 'bg-blue-100 text-blue-700',
  facebook_ad: 'bg-indigo-100 text-indigo-700', instagram_ad: 'bg-pink-100 text-pink-700',
  referral: 'bg-purple-100 text-purple-700', other: 'bg-slate-100 text-slate-600',
}

const LEAD_STATUS_BADGE = {
  new: 'bg-slate-100 text-slate-600', contacted: 'bg-blue-100 text-blue-700',
  trial_scheduled: 'bg-amber-100 text-amber-700', trial_completed: 'bg-orange-100 text-orange-700',
  converted: 'bg-emerald-100 text-emerald-700', lost: 'bg-rose-100 text-rose-700',
}

// ── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] ?? 'unknown'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
}

// ── main component ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const [studentsRes, leadsRes, recentRes] = await Promise.all([
        supabase.from('students').select('status, program, location_id, locations(name)'),
        supabase.from('leads').select('id, status, created_at'),
        supabase
          .from('leads')
          .select('id, first_name, last_name, child_name, source, status, created_at, location_id, locations(name)')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (studentsRes.error || leadsRes.error || recentRes.error) {
        setError((studentsRes.error ?? leadsRes.error ?? recentRes.error).message)
        setLoading(false)
        return
      }

      const students = studentsRes.data ?? []
      const leads    = leadsRes.data ?? []
      const recent   = recentRes.data ?? []

      // KPIs
      const activeStudents  = students.filter(s => s.status === 'active').length
      const trialStudents   = students.filter(s => s.status === 'trial').length
      const totalLeads      = leads.length
      const convertedLeads  = leads.filter(l => l.status === 'converted').length
      const pipelineLeads   = leads.filter(l => l.status !== 'converted' && l.status !== 'lost').length
      const conversionRate  = totalLeads > 0
        ? ((convertedLeads / totalLeads) * 100).toFixed(1)
        : '0.0'

      // Breakdowns
      const activeByLocation = students
        .filter(s => s.status === 'active')
        .reduce((acc, s) => {
          const name = s.locations?.name ?? 'Unknown'
          acc[name] = (acc[name] ?? 0) + 1
          return acc
        }, {})

      const leadsByStatus  = groupBy(leads, 'status')
      const studentsByProg = groupBy(students.filter(s => s.status === 'active' || s.status === 'trial'), 'program')

      setData({
        activeStudents, trialStudents, totalLeads, convertedLeads,
        pipelineLeads, conversionRate, activeByLocation, leadsByStatus,
        studentsByProg, recent,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Loading dashboard…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-rose-500 text-sm">
        {error}
      </div>
    )
  }

  const {
    activeStudents, trialStudents, totalLeads, pipelineLeads,
    conversionRate, activeByLocation, leadsByStatus, studentsByProg, recent,
  } = data

  // Chart data
  const locationEntries = Object.entries(activeByLocation).sort((a, b) => b[1] - a[1])
  const locationMax = Math.max(...locationEntries.map(e => e[1]), 1)

  const statusOrder = ['new', 'contacted', 'trial_scheduled', 'trial_completed', 'converted', 'lost']
  const statusEntries = statusOrder
    .map(k => [k, leadsByStatus[k] ?? 0])
    .filter(([, v]) => v > 0)
  const statusMax = Math.max(...statusEntries.map(e => e[1]), 1)

  const programEntries = Object.entries(studentsByProg).sort((a, b) => b[1] - a[1])
  const programTotal = programEntries.reduce((s, [, v]) => s + v, 0)
  const programDonut = programEntries.map(([k, v]) => ({
    label: PROGRAM_META[k]?.label ?? k,
    value: v,
    color: PROGRAM_META[k]?.hex ?? '#cbd5e1',
    colorClass: PROGRAM_META[k]?.color ?? 'bg-slate-400',
  }))

  const rateColor = parseFloat(conversionRate) >= 20
    ? 'text-emerald-600' : parseFloat(conversionRate) >= 10
    ? 'text-amber-600' : 'text-slate-800'

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Students"
            value={activeStudents}
            sub={`${trialStudents} in trial`}
            accent="text-indigo-600"
          />
          <StatCard
            label="Leads in Pipeline"
            value={pipelineLeads}
            sub={`${totalLeads} total leads`}
          />
          <StatCard
            label="Conversion Rate"
            value={`${conversionRate}%`}
            sub="leads → converted"
            accent={rateColor}
          />
          <StatCard
            label="Trial Students"
            value={trialStudents}
            sub="pending conversion"
            accent="text-amber-600"
          />
        </div>

        {/* Mid row: location bars + lead status bars */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Active Students by Location">
            {locationEntries.length === 0 ? (
              <p className="text-xs text-slate-400">No active students yet.</p>
            ) : (
              locationEntries.map(([name, count]) => (
                <HBar key={name} label={name} value={count} max={locationMax} colorClass="bg-indigo-400" />
              ))
            )}
          </Card>

          <Card title="Leads by Status">
            {statusEntries.length === 0 ? (
              <p className="text-xs text-slate-400">No leads yet.</p>
            ) : (
              statusEntries.map(([status, count]) => (
                <HBar
                  key={status}
                  label={LEAD_STATUS_META[status]?.label ?? status}
                  value={count}
                  max={statusMax}
                  colorClass={LEAD_STATUS_META[status]?.color ?? 'bg-slate-400'}
                />
              ))
            )}
          </Card>
        </div>

        {/* Bottom row: program breakdown + recent leads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <Card title="Students by Program (active + trial)">
            {programDonut.length === 0 ? (
              <p className="text-xs text-slate-400">No students enrolled yet.</p>
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 shrink-0">
                  <DonutChart segments={programDonut} />
                </div>
                <div className="flex-1 space-y-2">
                  {programDonut.map(seg => (
                    <div key={seg.label} className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-sm shrink-0 ${seg.colorClass}`} />
                      <span className="text-xs text-slate-600 flex-1 truncate">{seg.label}</span>
                      <span className="text-xs font-semibold text-slate-700">{seg.value}</span>
                      <span className="text-xs text-slate-400 w-9 text-right">
                        {programTotal > 0 ? ((seg.value / programTotal) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  ))}
                  <div className="pt-1 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-medium">
                    <span>Total</span>
                    <span>{programTotal}</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card title="Recent Leads">
            {recent.length === 0 ? (
              <p className="text-xs text-slate-400">No leads yet.</p>
            ) : (
              <div className="space-y-3">
                {recent.map(lead => (
                  <div key={lead.id} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate leading-tight">
                        {lead.first_name} {lead.last_name}
                        {lead.child_name && (
                          <span className="text-slate-400 font-normal"> · {lead.child_name}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {lead.locations?.name ?? '—'} · {timeAgo(lead.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {lead.source && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SOURCE_COLORS[lead.source] ?? SOURCE_COLORS.other}`}>
                          {SOURCE_LABELS[lead.source] ?? lead.source}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LEAD_STATUS_BADGE[lead.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {LEAD_STATUS_META[lead.status]?.label ?? lead.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      </div>
    </div>
  )
}
