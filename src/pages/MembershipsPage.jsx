import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const CYCLE_SUFFIX  = { weekly: '/wk', biweekly: '/2wk', monthly: '/mo' }
const CYCLE_MONTHLY = { weekly: 4.333, biweekly: 2.167, monthly: 1 }

function toMonthly(price, cycle) {
  return price * (CYCLE_MONTHLY[cycle] ?? 1)
}

function getProgram(name) {
  if (name.startsWith('Tigers'))     return 'Tigers'
  if (name.startsWith('Kids'))       return 'Kids'
  if (name.startsWith('Teen'))       return 'Teen/Adult'
  if (name.startsWith('Afterschool'))return 'Afterschool'
  if (name.startsWith('Leadership')) return 'Leadership'
  return 'Other'
}

function fmt$(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// ── sub-components ────────────────────────────────────────────────────────────

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

function TypeRow({ type, activeCount }) {
  const monthlyRev = toMonthly(type.price, type.billing_cycle) * activeCount
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-2.5 text-sm text-slate-700">{type.name}</td>
      <td className="px-4 py-2.5 text-xs text-slate-500 capitalize">{type.billing_cycle}</td>
      <td className="px-4 py-2.5 text-sm font-medium text-slate-700 whitespace-nowrap">
        ${type.price}{CYCLE_SUFFIX[type.billing_cycle] ?? ''}
      </td>
      <td className="px-4 py-2.5 text-center">
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
          activeCount > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
        }`}>
          {activeCount}
        </span>
      </td>
      <td className="px-4 py-2.5 text-sm text-right">
        {activeCount > 0
          ? <span className="text-emerald-600 font-medium">{fmt$(monthlyRev)}</span>
          : <span className="text-slate-300">—</span>
        }
      </td>
    </tr>
  )
}

function TypeTable({ types, countMap }) {
  return (
    <table className="w-full text-sm mb-2">
      <thead>
        <tr className="border-b border-slate-200">
          {['Membership', 'Cycle', 'Price', 'Active', 'Est. Monthly Rev'].map((h, i) => (
            <th key={h} className={`px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide ${i === 3 ? 'text-center' : i === 4 ? 'text-right' : 'text-left'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {types.map(t => (
          <TypeRow key={t.id} type={t} activeCount={countMap[t.id] ?? 0} />
        ))}
      </tbody>
    </table>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function MembershipsPage() {
  const { scopedLocationId } = useAuth()
  const [types, setTypes] = useState([])
  const [countMap, setCountMap] = useState({})   // membership_type_id → active count
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [typesRes, activeMembRes] = await Promise.all([
      supabase.from('membership_types').select('*').eq('active', true).order('category').order('name'),
      (() => {
        let q = supabase
          .from('student_memberships')
          .select('membership_type_id, students(location_id)')
          .eq('status', 'active')
        // Apply location scope via join: only count students at this location
        return q
      })(),
    ])

    if (typesRes.error) { setError(typesRes.error.message); setLoading(false); return }
    if (activeMembRes.error) { setError(activeMembRes.error.message); setLoading(false); return }

    setTypes(typesRes.data ?? [])

    // Build count map — apply location scope client-side if needed
    const activeMemberships = (activeMembRes.data ?? []).filter(m =>
      !scopedLocationId || m.students?.location_id === scopedLocationId
    )
    const map = {}
    activeMemberships.forEach(m => {
      map[m.membership_type_id] = (map[m.membership_type_id] ?? 0) + 1
    })
    setCountMap(map)
    setLoading(false)
  }, [scopedLocationId])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading memberships…</div>
  )
  if (error) return (
    <div className="flex-1 flex items-center justify-center text-rose-500 text-sm">{error}</div>
  )

  // Group types
  const afterschoolTypes  = types.filter(t => t.category === 'afterschool')
  const martialArtsTypes  = types.filter(t => t.category === 'martial_arts')
  const leadershipTypes   = types.filter(t => t.category === 'leadership')

  // Sub-group martial arts
  const maGroups = {}
  martialArtsTypes.forEach(t => {
    const prog = getProgram(t.name)
    if (!maGroups[prog]) maGroups[prog] = []
    maGroups[prog].push(t)
  })

  // Stats
  const totalActive   = Object.values(countMap).reduce((s, n) => s + n, 0)
  const totalMonthly  = types.reduce((s, t) =>
    s + toMonthly(t.price, t.billing_cycle) * (countMap[t.id] ?? 0), 0)

  const sectionStats = (typeList) => ({
    count:      typeList.reduce((s, t) => s + (countMap[t.id] ?? 0), 0),
    monthlyRev: typeList.reduce((s, t) => s + toMonthly(t.price, t.billing_cycle) * (countMap[t.id] ?? 0), 0),
  })

  const asStats = sectionStats(afterschoolTypes)
  const maStats = sectionStats(martialArtsTypes)
  const ldStats = sectionStats(leadershipTypes)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Memberships</h2>
            <p className="text-xs text-slate-500">18 types · {totalActive} active members</p>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* After School */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <SectionHeader title="After School" {...asStats} />
            </div>
            <TypeTable types={afterschoolTypes} countMap={countMap} />
          </section>

          {/* Martial Arts */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <SectionHeader title="Martial Arts" {...maStats} />
            </div>
            {Object.entries(maGroups).map(([prog, progTypes]) => (
              <div key={prog}>
                <p className="px-4 py-1.5 text-xs font-semibold text-slate-400 bg-slate-50 border-y border-slate-100">
                  {prog}
                </p>
                <TypeTable types={progTypes} countMap={countMap} />
              </div>
            ))}
          </section>

          {/* Leadership */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <SectionHeader title="Leadership" {...ldStats} />
            </div>
            <TypeTable types={leadershipTypes} countMap={countMap} />
          </section>

        </div>
      </div>
    </div>
  )
}
