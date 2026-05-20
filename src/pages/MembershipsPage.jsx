import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { syncStudentProgram, checkEnrollmentConflict } from '../lib/membership'

const CYCLE_SUFFIX  = { weekly: '/wk', biweekly: '/2wk', monthly: '/mo' }
const CYCLE_MONTHLY = { weekly: 4.333, biweekly: 2.167, monthly: 1 }

function toMonthly(price, cycle) {
  return price * (CYCLE_MONTHLY[cycle] ?? 1)
}

function getProgram(name) {
  if (name.startsWith('Tigers'))      return 'Tigers'
  if (name.startsWith('Kids'))        return 'Kids'
  if (name.startsWith('Teen'))        return 'Teen/Adult'
  if (name.startsWith('Afterschool')) return 'Afterschool'
  if (name.startsWith('Leadership'))  return 'Leadership'
  return 'Other'
}

function fmt$(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// ── Expanded detail view per membership type ─────────────────────────────────

function ExpandedTypeView({ type, onRefreshCounts }) {
  const { canEdit, scopedLocationId } = useAuth()
  const [enrolled, setEnrolled]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [showSearch, setShowSearch]     = useState(false)
  const [search, setSearch]             = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [enrolling, setEnrolling]       = useState(false)
  const [enrollError, setEnrollError]   = useState(null)
  const searchRef = useRef()

  useEffect(() => { loadEnrolled() }, [type.id])

  // Debounced student search
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = search.trim()
      if (q.length < 2) { setSearchResults([]); return }
      let query = supabase
        .from('students')
        .select('id, student_first_name, student_last_name, location_id, locations(name)')
        .or(`student_first_name.ilike.%${q}%,student_last_name.ilike.%${q}%`)
        .limit(8)
      if (scopedLocationId) query = query.eq('location_id', scopedLocationId)
      const { data } = await query
      // Exclude already-enrolled students
      const enrolledIds = new Set(enrolled.map(e => e.student_id))
      setSearchResults((data ?? []).filter(s => !enrolledIds.has(s.id)))
    }, 280)
    return () => clearTimeout(t)
  }, [search, enrolled, scopedLocationId])

  async function loadEnrolled() {
    setLoading(true)
    let q = supabase
      .from('student_memberships')
      .select('id, student_id, start_date, students(id, student_first_name, student_last_name, parent_phone, location_id, locations(name))')
      .eq('membership_type_id', type.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    const { data } = await q
    // Apply location scope client-side
    const rows = (data ?? []).filter(m =>
      !scopedLocationId || m.students?.location_id === scopedLocationId
    )
    setEnrolled(rows)
    setLoading(false)
  }

  async function enrollStudent(student) {
    setEnrolling(true)
    setEnrollError(null)

    const conflict = await checkEnrollmentConflict(student.id, type.category)
    if (conflict) {
      setEnrollError(conflict)
      setEnrolling(false)
      return
    }

    const { error } = await supabase.from('student_memberships').insert({
      student_id:         student.id,
      membership_type_id: type.id,
      status:             'active',
      start_date:         new Date().toISOString().slice(0, 10),
    })

    if (error) {
      setEnrollError(error.message)
      setEnrolling(false)
      return
    }

    await syncStudentProgram(student.id)
    setSearch('')
    setSearchResults([])
    setShowSearch(false)
    setEnrolling(false)
    setEnrollError(null)
    loadEnrolled()
    onRefreshCounts()
  }

  async function removeEnrollment(membershipId, studentId) {
    await supabase.from('student_memberships').update({ status: 'cancelled' }).eq('id', membershipId)
    await syncStudentProgram(studentId)
    loadEnrolled()
    onRefreshCounts()
  }

  return (
    <div className="bg-slate-50 border-t border-slate-200 px-6 py-4">
      {loading ? (
        <p className="text-xs text-slate-400 py-2">Loading enrolled students…</p>
      ) : (
        <>
          {enrolled.length === 0 && (
            <p className="text-xs text-slate-400 italic mb-3">No students currently enrolled in this plan.</p>
          )}

          {enrolled.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
              {enrolled.map(m => {
                const s = m.students
                return (
                  <div key={m.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 border border-slate-200 shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {s?.student_first_name} {s?.student_last_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {s?.locations?.name ?? '—'}
                        {m.start_date && ` · since ${new Date(m.start_date).toLocaleDateString()}`}
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => removeEnrollment(m.id, s?.id)}
                        className="text-xs text-rose-500 hover:text-rose-700 shrink-0 border border-rose-200 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Add Student */}
          {canEdit && (
            <div>
              {!showSearch ? (
                <button
                  onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50) }}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  + Add Student to {type.name}
                </button>
              ) : (
                <div className="flex items-start gap-2 flex-wrap">
                  <div className="relative">
                    <input
                      ref={searchRef}
                      type="search"
                      value={search}
                      onChange={e => { setSearch(e.target.value); setEnrollError(null) }}
                      placeholder="Search student name…"
                      className="border border-indigo-300 rounded-lg px-3 py-1.5 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      autoComplete="off"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 w-72 overflow-hidden">
                        {searchResults.map(s => (
                          <button
                            key={s.id}
                            onClick={() => enrollStudent(s)}
                            disabled={enrolling}
                            className="w-full flex items-center gap-2 text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">
                                {s.student_first_name} {s.student_last_name}
                              </p>
                              <p className="text-xs text-slate-400">{s.locations?.name ?? '—'}</p>
                            </div>
                            {enrolling && <span className="text-xs text-slate-400">Adding…</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowSearch(false); setSearch(''); setSearchResults([]); setEnrollError(null) }}
                    className="text-xs text-slate-500 hover:text-slate-700 py-1.5"
                  >
                    Cancel
                  </button>
                  {enrollError && (
                    <p className="text-xs text-rose-600 py-1.5 w-full">{enrollError}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, count, monthlyRev }) {
  return (
    <div className="flex items-center justify-between px-1 mb-2 mt-6 first:mt-0">
      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h3>
      <div className="flex gap-4 text-xs text-slate-500">
        <span><strong className="text-slate-700">{count}</strong> active</span>
        <span><strong className="text-emerald-600">{fmt$(monthlyRev)}</strong>/mo est.</span>
      </div>
    </div>
  )
}

// ── Type table with expandable rows ──────────────────────────────────────────

function TypeTable({ types, countMap, expandedId, onToggle, onRefreshCounts }) {
  return (
    <table className="w-full text-sm mb-2">
      <thead>
        <tr className="border-b border-slate-200">
          {['Membership', 'Cycle', 'Price', 'Active', 'Est. Monthly Rev', ''].map((h, i) => (
            <th key={i} className={`px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide ${
              i === 3 ? 'text-center' : i === 4 ? 'text-right' : 'text-left'
            }`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {types.map(t => {
          const isExpanded   = expandedId === t.id
          const activeCount  = countMap[t.id] ?? 0
          const monthlyRev   = toMonthly(t.price, t.billing_cycle) * activeCount
          return (
            <>
              <tr
                key={t.id}
                onClick={() => onToggle(t.id)}
                className={`cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
              >
                <td className="px-4 py-2.5 font-medium text-slate-700">{t.name}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500 capitalize">{t.billing_cycle}</td>
                <td className="px-4 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                  ${t.price}{CYCLE_SUFFIX[t.billing_cycle] ?? ''}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                    activeCount > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {activeCount}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {activeCount > 0
                    ? <span className="text-emerald-600 font-medium">{fmt$(monthlyRev)}</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-400 text-xs w-8">
                  {isExpanded ? '▲' : '▼'}
                </td>
              </tr>
              {isExpanded && (
                <tr key={`${t.id}-exp`}>
                  <td colSpan={6} className="p-0">
                    <ExpandedTypeView type={t} onRefreshCounts={onRefreshCounts} />
                  </td>
                </tr>
              )}
            </>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MembershipsPage() {
  const { scopedLocationId } = useAuth()
  const [types, setTypes]       = useState([])
  const [countMap, setCountMap] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [typesRes, activeMembRes] = await Promise.all([
      supabase.from('membership_types').select('*').eq('active', true).order('category').order('name'),
      supabase.from('student_memberships').select('membership_type_id, students(location_id)').eq('status', 'active'),
    ])

    if (typesRes.error)     { setError(typesRes.error.message);     setLoading(false); return }
    if (activeMembRes.error){ setError(activeMembRes.error.message); setLoading(false); return }

    setTypes(typesRes.data ?? [])

    const active = (activeMembRes.data ?? []).filter(m =>
      !scopedLocationId || m.students?.location_id === scopedLocationId
    )
    const map = {}
    active.forEach(m => { map[m.membership_type_id] = (map[m.membership_type_id] ?? 0) + 1 })
    setCountMap(map)
    setLoading(false)
  }, [scopedLocationId])

  useEffect(() => { load() }, [load])

  function toggleExpand(typeId) {
    setExpandedId(prev => prev === typeId ? null : typeId)
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading memberships…</div>
  if (error)   return <div className="flex-1 flex items-center justify-center text-rose-500 text-sm">{error}</div>

  const afterschoolTypes = types.filter(t => t.category === 'afterschool')
  const martialArtsTypes = types.filter(t => t.category === 'martial_arts')
  const leadershipTypes  = types.filter(t => t.category === 'leadership')

  const maGroups = {}
  martialArtsTypes.forEach(t => {
    const prog = getProgram(t.name)
    if (!maGroups[prog]) maGroups[prog] = []
    maGroups[prog].push(t)
  })

  const totalActive  = Object.values(countMap).reduce((s, n) => s + n, 0)
  const totalMonthly = types.reduce((s, t) => s + toMonthly(t.price, t.billing_cycle) * (countMap[t.id] ?? 0), 0)

  const sectionStats = list => ({
    count:      list.reduce((s, t) => s + (countMap[t.id] ?? 0), 0),
    monthlyRev: list.reduce((s, t) => s + toMonthly(t.price, t.billing_cycle) * (countMap[t.id] ?? 0), 0),
  })

  const tableProps = { countMap, expandedId, onToggle: toggleExpand, onRefreshCounts: load }

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Memberships</h2>
            <p className="text-xs text-slate-500">{types.length} types · {totalActive} active members · click any row to view enrolled students</p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs text-slate-400">Active Members</p>
              <p className="text-2xl font-bold text-indigo-600">{totalActive}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Est. Monthly Revenue</p>
              <p className="text-2xl font-bold text-emerald-600">{fmt$(totalMonthly)}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <SectionHeader title="After School" {...sectionStats(afterschoolTypes)} />
            </div>
            <TypeTable types={afterschoolTypes} {...tableProps} />
          </section>

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <SectionHeader title="Martial Arts" {...sectionStats(martialArtsTypes)} />
            </div>
            {Object.entries(maGroups).map(([prog, progTypes]) => (
              <div key={prog}>
                <p className="px-4 py-1.5 text-xs font-semibold text-slate-400 bg-slate-50 border-y border-slate-100">{prog}</p>
                <TypeTable types={progTypes} {...tableProps} />
              </div>
            ))}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <SectionHeader title="Leadership" {...sectionStats(leadershipTypes)} />
            </div>
            <TypeTable types={leadershipTypes} {...tableProps} />
          </section>

        </div>
      </div>
    </div>
  )
}
