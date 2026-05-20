import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const CLASS_TYPES = {
  martial_arts: 'TKD',
  afterschool:  'ASP',
}

const BELT_DOT = {
  white: 'bg-gray-300', yellow: 'bg-yellow-400', orange: 'bg-orange-400',
  green: 'bg-green-500', blue: 'bg-blue-500', red: 'bg-red-600', black: 'bg-gray-900',
}

function BeltDot({ rank }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 ${BELT_DOT[rank] ?? 'bg-gray-300'}`} />
}

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t) }, [])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-lg z-50 animate-bounce">
      {msg}
    </div>
  )
}

// ── Check-in view ─────────────────────────────────────────────────────────────

function CheckInView({ classTab, locationId, staff }) {
  const { canEdit } = useAuth()
  const [search, setSearch]         = useState('')
  const [results, setResults]       = useState([])
  const [selected, setSelected]     = useState(null)
  const [checkedInIds, setCheckedInIds] = useState(new Set())
  const [todayList, setTodayList]   = useState([])
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState(null)
  const searchRef = useRef()

  const today      = new Date().toISOString().slice(0, 10)
  const classType  = CLASS_TYPES[classTab]

  const loadToday = useCallback(async () => {
    if (!locationId) return
    const { data } = await supabase
      .from('attendance')
      .select('*, students(student_first_name, student_last_name, belt_rank, program, stripe_count)')
      .eq('class_date', today)
      .eq('class_type', classType)
      .eq('location_id', locationId)
      .order('checked_in_at', { ascending: false })
    const list = data ?? []
    setTodayList(list)
    setCheckedInIds(new Set(list.map(a => a.student_id)))
  }, [locationId, classType, today])

  useEffect(() => { loadToday() }, [loadToday])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = search.trim()
      if (q.length < 2) { setResults([]); return }
      let query = supabase
        .from('students')
        .select('id, student_first_name, student_last_name, parent_first_name, parent_last_name, belt_rank, program, location_id')
        .or(`student_first_name.ilike.%${q}%,student_last_name.ilike.%${q}%`)
        .limit(8)
      if (locationId) query = query.eq('location_id', locationId)
      const { data } = await query
      setResults(data ?? [])
    }, 280)
    return () => clearTimeout(t)
  }, [search, locationId])

  async function checkIn() {
    console.log('[CheckIn] button clicked', { selected, locationId, canEdit })

    if (!canEdit) {
      console.warn('[CheckIn] blocked: user does not have canEdit permission')
      return
    }
    if (!selected) {
      console.warn('[CheckIn] blocked: no student selected')
      return
    }
    if (!locationId) {
      console.warn('[CheckIn] blocked: no location selected — admin must pick a specific location')
      setToast('⚠ Please select a location before checking in')
      return
    }

    setSaving(true)

    const now = new Date()
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

    const attendancePayload = {
      student_id:     selected.id,
      location_id:    locationId,
      class_date:     today,
      class_time:     timeStr,
      class_type:     classType,
      checked_in_by:  staff?.id ?? null,
      points_awarded: 10,
    }
    console.log('[CheckIn] inserting attendance:', attendancePayload)

    const { data: att, error: attError } = await supabase
      .from('attendance')
      .insert(attendancePayload)
      .select()
      .single()

    console.log('[CheckIn] attendance result:', { att, error: attError })

    if (attError) {
      console.error('[CheckIn] attendance insert failed:', attError)
      setSaving(false)
      return
    }

    const pointsPayload = {
      student_id:   selected.id,
      location_id:  locationId,
      points:       10,
      reason:       'attendance',
      reference_id: att.id,
      awarded_by:   staff?.id ?? null,
    }
    console.log('[CheckIn] inserting points_log:', pointsPayload)

    const { error: pointsError } = await supabase
      .from('points_log')
      .insert(pointsPayload)

    console.log('[CheckIn] points_log result:', { error: pointsError })
    if (pointsError) console.error('[CheckIn] points_log insert failed:', pointsError)

    setToast(`✓ ${selected.student_first_name} checked in — +10 pts`)

    setSelected(null)
    setSearch('')
    setResults([])
    setSaving(false)
    loadToday()
  }

  async function undo(att) {
    await supabase.from('points_log').delete().eq('reference_id', att.id)
    await supabase.from('attendance').delete().eq('id', att.id)
    loadToday()
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      {/* Search + check-in */}
      {canEdit && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Check In a Student
          </p>
          <div className="relative">
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null) }}
              placeholder="Type student name…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-10"
              autoComplete="off"
            />

            {/* Dropdown results */}
            {results.length > 0 && !selected && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                {results.map(s => {
                  const alreadyIn = checkedInIds.has(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSelected(s); setResults([]) }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors ${alreadyIn ? 'opacity-50' : ''}`}
                    >
                      <BeltDot rank={s.belt_rank} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {s.student_first_name} {s.student_last_name}
                          {alreadyIn && <span className="ml-2 text-xs text-emerald-600 font-normal">✓ checked in</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                          Parent: {s.parent_first_name} {s.parent_last_name}
                          {s.belt_rank && ` · ${s.belt_rank} belt`}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Selected student + check-in button */}
          {selected && (
            <div className="mt-3 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
              <BeltDot rank={selected.belt_rank} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-indigo-900">
                  {selected.student_first_name} {selected.student_last_name}
                </p>
                <p className="text-xs text-indigo-600">
                  {selected.belt_rank ? `${selected.belt_rank} belt` : 'No rank set'}
                </p>
              </div>
              {checkedInIds.has(selected.id) ? (
                <span className="text-xs text-emerald-600 font-medium">Already checked in today</span>
              ) : (
                <button
                  onClick={checkIn}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Checking in…' : '✓ Check In  +10 pts'}
                </button>
              )}
              <button onClick={() => { setSelected(null); setSearch('') }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
          )}
        </div>
      )}

      {/* Today's list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            Today's Check-ins
            <span className="ml-2 text-xs text-slate-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </p>
          <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
            {todayList.length}
          </span>
        </div>

        {todayList.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">No check-ins yet today.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayList.map(att => {
              const s = att.students
              return (
                <div key={att.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="text-xs text-slate-400 w-16 shrink-0">{att.class_time}</div>
                  <BeltDot rank={s?.belt_rank} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {s?.student_first_name} {s?.student_last_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {att.class_type}{s?.belt_rank ? ` · ${s.belt_rank} belt` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-emerald-600 font-semibold shrink-0">+{att.points_awarded ?? 10} pts</span>
                  {canEdit && (
                    <button
                      onClick={() => undo(att)}
                      className="text-xs text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 px-2 py-0.5 rounded transition-colors shrink-0"
                    >
                      Undo
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── History view ──────────────────────────────────────────────────────────────

function HistoryView({ locationId, isAdmin, locations }) {
  const [from, setFrom]     = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [to, setTo]         = useState(new Date().toISOString().slice(0, 10))
  const [locFilter, setLoc] = useState(locationId ?? 'all')
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetch() }, [from, to, locFilter])

  async function fetch() {
    setLoading(true)
    let q = supabase
      .from('attendance')
      .select('*, students(student_first_name, student_last_name, belt_rank, program), locations(name)')
      .gte('class_date', from)
      .lte('class_date', to)
      .order('checked_in_at', { ascending: false })
      .limit(200)
    if (locFilter !== 'all') q = q.eq('location_id', locFilter)
    else if (locationId) q = q.eq('location_id', locationId)
    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-3 items-center">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <span className="text-slate-400 text-sm">→</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        {isAdmin && (
          <select value={locFilter} onChange={e => setLoc(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="all">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <span className="text-xs text-slate-400 ml-auto">{rows.length} records</span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No attendance records in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Date', 'Student', 'Class', 'Belt', 'Location', 'Time', 'Pts'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{r.class_date}</td>
                  <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">
                    {r.students?.student_first_name} {r.students?.student_last_name}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.class_type}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <BeltDot rank={r.students?.belt_rank} />
                      <span className="text-xs text-slate-500 capitalize">{r.students?.belt_rank ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{r.locations?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{r.class_time}</td>
                  <td className="px-4 py-2 text-emerald-600 font-semibold text-xs">+{r.points_awarded ?? 10}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { scopedLocationId, isAdmin, staff } = useAuth()
  const [classTab, setClassTab] = useState('martial_arts')
  const [viewTab,  setViewTab]  = useState('checkin')
  const [locationId, setLocationId] = useState(scopedLocationId)
  const [locations, setLocations]   = useState([])

  useEffect(() => {
    supabase.from('locations').select('*').order('name').then(({ data }) => {
      if (data) setLocations(data)
    })
  }, [])

  // Keep location in sync when scopedLocationId changes (auth load)
  useEffect(() => { setLocationId(scopedLocationId) }, [scopedLocationId])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Attendance</h2>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          {isAdmin && (
            <select
              value={locationId ?? 'all'}
              onChange={e => setLocationId(e.target.value === 'all' ? null : e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="all">All Locations</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>

        {/* Class type tabs */}
        <div className="flex gap-1 mb-3">
          {[['martial_arts', 'Martial Arts'], ['afterschool', 'After School']].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setClassTab(k)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                classTab === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            {[['checkin', 'Check In'], ['history', 'History']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setViewTab(k)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  viewTab === k ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {viewTab === 'checkin'
            ? <CheckInView classTab={classTab} locationId={locationId} staff={staff} />
            : <HistoryView locationId={locationId} isAdmin={isAdmin} locations={locations} />
          }
        </div>
      </div>
    </div>
  )
}
