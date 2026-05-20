import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const BELT_DOT = {
  white: 'bg-gray-300', yellow: 'bg-yellow-400', orange: 'bg-orange-400',
  green: 'bg-green-500', blue: 'bg-blue-500', red: 'bg-red-600', black: 'bg-gray-900',
}

const RANK_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

const ADJUST_REASONS = [
  { value: 'referral',          label: 'Referral' },
  { value: 'event',             label: 'Event' },
  { value: 'perfect_attendance', label: 'Perfect Attendance' },
  { value: 'belt_promotion',    label: 'Belt Promotion' },
  { value: 'manual_adjustment', label: 'Manual Adjustment' },
]

function startOfMonth() {
  const d = new Date()
  d.setDate(1); d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function AdjustModal({ student, onClose, onSave, staffId }) {
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('manual_adjustment')
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const pts = parseInt(points)
    if (!pts) { setError('Enter a non-zero point value.'); return }
    setSaving(true)
    const { error } = await supabase.from('points_log').insert({
      student_id:  student.student_id,
      location_id: student.location_id,
      points:      pts,
      reason,
      notes:       notes || null,
      awarded_by:  staffId ?? null,
    })
    if (error) { setError(error.message); setSaving(false); return }
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Adjust Points</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {student.first_name} {student.last_name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Points (use negative to deduct)</label>
            <input
              required type="number" value={points} onChange={e => setPoints(e.target.value)}
              placeholder="e.g. 50 or -10"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {ADJUST_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  const { isAdmin, canEdit, scopedLocationId, staff } = useAuth()
  const [period,   setPeriod]   = useState('monthly')
  const [locFilter, setLocFilter] = useState('all')
  const [rankings, setRankings] = useState([])
  const [locations, setLocations] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [adjustModal, setAdjustModal] = useState(null)

  useEffect(() => {
    supabase.from('locations').select('*').order('name').then(({ data }) => {
      if (data) setLocations(data)
    })
  }, [])

  const fetchRankings = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('points_log')
      .select('student_id, points, awarded_at, location_id, students(student_first_name, student_last_name, belt_rank, location_id, locations(name, slug))')

    if (period === 'monthly') q = q.gte('awarded_at', startOfMonth())

    const effectiveLoc = scopedLocationId ?? (locFilter !== 'all' ? locFilter : null)
    if (effectiveLoc) q = q.eq('location_id', effectiveLoc)

    const { data } = await q

    // Group and sum
    const map = {}
    ;(data ?? []).forEach(row => {
      const sid = row.student_id
      if (!map[sid]) {
        const s = row.students
        map[sid] = {
          student_id:   sid,
          first_name:   s?.student_first_name ?? '—',
          last_name:    s?.student_last_name ?? '',
          belt_rank:    s?.belt_rank,
          location_id:  s?.location_id,
          location_name: s?.locations?.name ?? '—',
          points: 0,
        }
      }
      map[sid].points += row.points
    })

    setRankings(
      Object.values(map)
        .sort((a, b) => b.points - a.points)
        .map((r, i) => ({ ...r, rank: i + 1 }))
    )
    setLoading(false)
  }, [period, locFilter, scopedLocationId])

  useEffect(() => { fetchRankings() }, [fetchRankings])

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Leaderboard</h2>
            <p className="text-xs text-slate-500">{rankings.length} students ranked</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Period toggle */}
          <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
            {[['monthly', 'This Month'], ['lifetime', 'Lifetime']].map(([k, label]) => (
              <button key={k} onClick={() => setPeriod(k)}
                className={`px-4 py-1.5 font-medium transition-colors ${period === k ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Location filter (admin only — scoped users always see their location) */}
          {!scopedLocationId && (
            <select value={locFilter} onChange={e => setLocFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="all">All Locations</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
        ) : rankings.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No points recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                {['Rank', 'Student', 'Belt', 'Location', 'Points', isAdmin && canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rankings.map(row => (
                <tr key={row.student_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-600 text-base w-16">
                    {RANK_MEDAL[row.rank] ?? <span className="text-slate-400">{row.rank}</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {row.first_name} {row.last_name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${BELT_DOT[row.belt_rank] ?? 'bg-gray-300'}`} />
                      <span className="text-xs text-slate-500 capitalize">{row.belt_rank ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{row.location_name}</td>
                  <td className="px-4 py-3 font-bold text-indigo-600 text-base">{row.points.toLocaleString()}</td>
                  {isAdmin && canEdit && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setAdjustModal(row)}
                        className="text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-2.5 py-1 rounded transition-colors"
                      >
                        Adjust
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adjustModal && (
        <AdjustModal
          student={adjustModal}
          staffId={staff?.id}
          onClose={() => setAdjustModal(null)}
          onSave={() => { setAdjustModal(null); fetchRankings() }}
        />
      )}
    </div>
  )
}
