import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const BELT_COLOR = {
  white:  { bg: 'bg-gray-200',   text: 'text-gray-700',  label: 'White'  },
  yellow: { bg: 'bg-yellow-400', text: 'text-yellow-900', label: 'Yellow' },
  orange: { bg: 'bg-orange-400', text: 'text-orange-900', label: 'Orange' },
  green:  { bg: 'bg-green-500',  text: 'text-white',      label: 'Green'  },
  blue:   { bg: 'bg-blue-500',   text: 'text-white',      label: 'Blue'   },
  red:    { bg: 'bg-red-600',    text: 'text-white',      label: 'Red'    },
  black:  { bg: 'bg-gray-900',   text: 'text-white',      label: 'Black'  },
}

const PODIUM = [
  { rank: 2, medal: '🥈', ringCls: 'ring-2 ring-slate-400', nameSz: 'text-2xl', ptsSz: 'text-xl', padH: 'h-36', labelCls: 'text-slate-300' },
  { rank: 1, medal: '🥇', ringCls: 'ring-4 ring-yellow-400 shadow-yellow-400/40 shadow-lg', nameSz: 'text-3xl', ptsSz: 'text-2xl', padH: 'h-48', labelCls: 'text-yellow-300' },
  { rank: 3, medal: '🥉', ringCls: 'ring-2 ring-orange-600', nameSz: 'text-xl',  ptsSz: 'text-lg',  padH: 'h-28', labelCls: 'text-orange-400' },
]

function privName(first, last) {
  return `${first} ${(last ?? '').charAt(0)}.`
}

function startOfMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function BeltBadge({ rank }) {
  const b = BELT_COLOR[rank]
  if (!b) return null
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${b.bg} ${b.text}`}>
      {b.label}
    </span>
  )
}

export default function PublicLeaderboard() {
  const { slug }   = useParams()
  const [period, setPeriod]       = useState('monthly')
  const [location, setLocation]   = useState(null)  // null = all
  const [rankings, setRankings]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [countdown, setCountdown] = useState(60)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    let locationId = null

    if (slug !== 'all') {
      const { data: loc } = await supabase
        .from('locations')
        .select('id, name')
        .eq('slug', slug)
        .maybeSingle()
      if (loc) { setLocation(loc); locationId = loc.id }
      else { setLocation(null) }
    } else {
      setLocation({ name: 'All Locations' })
    }

    let q = supabase
      .from('points_log')
      .select('student_id, points, awarded_at, students(student_first_name, student_last_name, belt_rank)')

    if (period === 'monthly') q = q.gte('awarded_at', startOfMonth())
    if (locationId) q = q.eq('location_id', locationId)

    const { data } = await q

    // Aggregate
    const map = {}
    ;(data ?? []).forEach(row => {
      const sid = row.student_id
      if (!row.students) return
      if (!map[sid]) {
        map[sid] = {
          student_id: sid,
          first_name: row.students.student_first_name,
          last_name:  row.students.student_last_name,
          belt_rank:  row.students.belt_rank,
          points: 0,
        }
      }
      map[sid].points += row.points
    })

    setRankings(
      Object.values(map)
        .sort((a, b) => b.points - a.points)
        .map((r, i) => ({ ...r, rank: i + 1 }))
        .slice(0, 20)
    )
    setLoading(false)
    setLastRefresh(new Date())
    setCountdown(60)
  }, [slug, period])

  // Auto-refresh every 60 s
  useEffect(() => {
    load()
    const refresh = setInterval(load, 60000)
    return () => clearInterval(refresh)
  }, [load])

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(tick)
  }, [lastRefresh])

  const top3    = rankings.slice(0, 3)
  const rest10  = rankings.slice(3, 10)
  const pos1120 = rankings.slice(10, 20)

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none">
      {/* Header */}
      <header className="text-center pt-10 pb-6 px-6">
        <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-1">Charleston Taekwondo</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          {location?.name ?? 'Unknown Location'}
        </h1>
        <p className="text-zinc-400 text-lg mt-1">
          {period === 'monthly' ? monthLabel : 'All-Time'} Leaderboard
        </p>

        {/* Period toggle */}
        <div className="flex justify-center gap-2 mt-4">
          {[['monthly', 'Monthly'], ['lifetime', 'Lifetime']].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                period === k
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {rankings.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-xl">
          No points recorded yet.
        </div>
      ) : (
        <div className="flex-1 px-6 pb-8 max-w-3xl mx-auto w-full">

          {/* Podium — top 3 */}
          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-4 mb-10">
              {PODIUM.map(({ rank, medal, ringCls, nameSz, ptsSz, padH, labelCls }) => {
                const student = top3.find(r => r.rank === rank)
                if (!student) return <div key={rank} className={`w-44 ${padH}`} />
                return (
                  <div key={rank} className="flex flex-col items-center">
                    <div className="text-4xl mb-3">{medal}</div>
                    <div className={`bg-zinc-800 rounded-2xl ${ringCls} p-5 w-44 ${padH} flex flex-col items-center justify-center text-center gap-2`}>
                      <p className={`font-black leading-tight ${nameSz}`}>
                        {privName(student.first_name, student.last_name)}
                      </p>
                      {student.belt_rank && <BeltBadge rank={student.belt_rank} />}
                      <p className={`font-bold ${ptsSz} ${labelCls}`}>
                        {student.points.toLocaleString()} <span className="text-sm font-normal">pts</span>
                      </p>
                    </div>
                    <p className="mt-2 text-zinc-500 text-xs font-semibold uppercase tracking-wider">#{rank}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Positions 4–10 */}
          {rest10.length > 0 && (
            <div className="bg-zinc-900 rounded-2xl overflow-hidden mb-6">
              {rest10.map((s, i) => (
                <div
                  key={s.student_id}
                  className={`flex items-center gap-4 px-6 py-4 ${i < rest10.length - 1 ? 'border-b border-zinc-800' : ''}`}
                >
                  <span className="text-zinc-500 font-bold text-lg w-8 text-center shrink-0">
                    {s.rank}
                  </span>
                  <p className="text-xl font-bold flex-1">
                    {privName(s.first_name, s.last_name)}
                  </p>
                  {s.belt_rank && <BeltBadge rank={s.belt_rank} />}
                  <p className="text-indigo-400 font-bold text-xl shrink-0">
                    {s.points.toLocaleString()}
                    <span className="text-sm text-zinc-500 font-normal ml-1">pts</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Positions 11–20 */}
          {pos1120.length > 0 && (
            <>
              <p className="text-xs text-zinc-600 uppercase tracking-widest font-semibold text-center mb-3">Also on the board</p>
              <div className="bg-zinc-900/60 rounded-xl overflow-hidden">
                {pos1120.map((s, i) => (
                  <div key={s.student_id}
                    className={`flex items-center gap-3 px-5 py-2.5 ${i < pos1120.length - 1 ? 'border-b border-zinc-800/60' : ''}`}>
                    <span className="text-zinc-600 font-semibold text-sm w-6 text-center shrink-0">{s.rank}</span>
                    <p className="text-base font-semibold flex-1 text-zinc-300">
                      {privName(s.first_name, s.last_name)}
                    </p>
                    {s.belt_rank && (
                      <span className={`inline-block w-3 h-3 rounded-full shrink-0 border border-white/10 ${BELT_COLOR[s.belt_rank]?.bg ?? 'bg-gray-400'}`} />
                    )}
                    <p className="text-zinc-400 font-semibold text-sm shrink-0">
                      {s.points.toLocaleString()} pts
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="text-center pb-6 text-xs text-zinc-600">
        Refreshes in {countdown}s · Last updated {lastRefresh.toLocaleTimeString()}
      </footer>
    </div>
  )
}
