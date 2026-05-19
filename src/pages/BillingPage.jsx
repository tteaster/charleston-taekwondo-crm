import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import BillingModal from '../components/BillingModal'

const BILLING_STATUS = {
  current:   { label: 'Current',   cls: 'bg-emerald-100 text-emerald-700' },
  past_due:  { label: 'Past Due',  cls: 'bg-amber-100  text-amber-700'  },
  failed:    { label: 'Failed',    cls: 'bg-rose-100   text-rose-700'   },
  paused:    { label: 'Paused',    cls: 'bg-slate-100  text-slate-600'  },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100   text-gray-500'   },
}

const STUDENT_STATUS = {
  trial:     'bg-amber-100 text-amber-700',
  active:    'bg-emerald-100 text-emerald-700',
  paused:    'bg-slate-100 text-slate-600',
  cancelled: 'bg-gray-100 text-gray-500',
}

const STATUS_FILTERS = [
  { key: 'all',        label: 'All' },
  { key: 'current',    label: 'Current' },
  { key: 'past_due',   label: 'Past Due' },
  { key: 'failed',     label: 'Failed' },
  { key: 'paused',     label: 'Paused' },
  { key: 'no_billing', label: 'No Billing' },
]

function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ordinal(n) {
  if (!n) return '—'
  const s = ['th','st','nd','rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default function BillingPage() {
  const { scopedLocationId } = useAuth()
  const [rows, setRows] = useState([])       // merged student+billing rows
  const [locations, setLocations] = useState([])
  const [filterLocation, setFilterLocation] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStudent, setModalStudent] = useState(null)
  const [modalBilling, setModalBilling] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    let studentsQuery = supabase
      .from('students')
      .select('id, student_first_name, student_last_name, parent_phone, status, location_id, locations(name)')
      .order('student_last_name')
    if (scopedLocationId) studentsQuery = studentsQuery.eq('location_id', scopedLocationId)

    const [studentsRes, locationsRes] = await Promise.all([
      studentsQuery,
      supabase.from('locations').select('*').order('name'),
    ])

    if (studentsRes.error) { setError(studentsRes.error.message); setLoading(false); return }

    const students = studentsRes.data ?? []
    if (locationsRes.data) setLocations(locationsRes.data)

    // Fetch all billing records
    const { data: billingData, error: billingErr } = await supabase
      .from('billing')
      .select('*')

    if (billingErr) { setError(billingErr.message); setLoading(false); return }

    const billingByStudent = (billingData ?? []).reduce((acc, b) => {
      acc[b.student_id] = b
      return acc
    }, {})

    setRows(students.map(s => ({ ...s, billing: billingByStudent[s.id] ?? null })))
    setLoading(false)
  }, [scopedLocationId])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSave(payload, billingId) {
    if (billingId) {
      const { data, error } = await supabase
        .from('billing')
        .update(payload)
        .eq('id', billingId)
        .select()
        .single()
      if (error) throw error
      setRows(prev => prev.map(r =>
        r.id === payload.student_id ? { ...r, billing: data } : r
      ))
    } else {
      const { data, error } = await supabase
        .from('billing')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      setRows(prev => prev.map(r =>
        r.id === payload.student_id ? { ...r, billing: data } : r
      ))
    }
    setModalOpen(false)
  }

  function openModal(student, billing) {
    setModalStudent(student)
    setModalBilling(billing ?? null)
    setModalOpen(true)
  }

  // ── filters ────────────────────────────────────────────────────────────────
  const effectiveLocation = scopedLocationId ?? filterLocation
  const filtered = rows.filter(r => {
    if (effectiveLocation !== 'all' && r.location_id !== effectiveLocation) return false
    if (filterStatus !== 'all') {
      if (filterStatus === 'no_billing' && r.billing) return false
      if (filterStatus !== 'no_billing' && r.billing?.status !== filterStatus) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const name = `${r.student_first_name} ${r.student_last_name}`.toLowerCase()
      if (!name.includes(q) && !r.parent_phone?.includes(q)) return false
    }
    return true
  })

  // ── summary stats ──────────────────────────────────────────────────────────
  const totalMRR = rows.reduce((sum, r) =>
    r.billing?.status === 'current' ? sum + (parseFloat(r.billing.monthly_rate) || 0) : sum, 0)

  const activeBilling = rows.filter(r => r.billing?.status === 'current').length
  const pastDueFailed = rows.filter(r => ['past_due', 'failed'].includes(r.billing?.status)).length
  const noBilling     = rows.filter(r => !r.billing).length

  const statusCounts = STATUS_FILTERS.reduce((acc, f) => {
    if (f.key === 'all') acc[f.key] = rows.length
    else if (f.key === 'no_billing') acc[f.key] = noBilling
    else acc[f.key] = rows.filter(r => r.billing?.status === f.key).length
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-800">Billing</h2>
          <p className="text-xs text-slate-500">{rows.length} student{rows.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard
            label="Monthly Revenue"
            value={`$${totalMRR.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            sub="active billing only"
            accent="text-emerald-600"
          />
          <StatCard
            label="Active Billing"
            value={activeBilling}
            sub="status: current"
            accent="text-indigo-600"
          />
          <StatCard
            label="Past Due / Failed"
            value={pastDueFailed}
            sub="needs attention"
            accent={pastDueFailed > 0 ? 'text-rose-600' : 'text-slate-800'}
          />
          <StatCard
            label="No Billing Set"
            value={noBilling}
            sub="missing record"
            accent={noBilling > 0 ? 'text-amber-600' : 'text-slate-800'}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="Search student name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {!scopedLocationId && (
            <select
              value={filterLocation}
              onChange={e => setFilterLocation(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="all">All Locations</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          )}

          <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
                  filterStatus === f.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
                <span className={`text-xs rounded-full px-1.5 leading-5 font-medium ${
                  filterStatus === f.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {statusCounts[f.key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading billing…</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-rose-600 text-sm">{error}</p>
            <button onClick={fetchData} className="text-sm text-indigo-600 hover:underline">Retry</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                {['Student', 'Location', 'Status', 'Monthly Rate', 'Billing Status', 'Bill Day', 'Next Date', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 text-sm py-12">
                    No results match your filters.
                  </td>
                </tr>
              ) : filtered.map(row => {
                const b = row.billing
                const bs = b ? (BILLING_STATUS[b.status] ?? BILLING_STATUS.current) : null
                return (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    {/* Student */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 whitespace-nowrap">
                        {row.student_first_name} {row.student_last_name}
                      </p>
                      {row.parent_phone && (
                        <p className="text-xs text-slate-400 mt-0.5">{row.parent_phone}</p>
                      )}
                    </td>
                    {/* Location */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.locations?.name ?? '—'}
                    </td>
                    {/* Enrollment status */}
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STUDENT_STATUS[row.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {row.status}
                      </span>
                    </td>
                    {/* Monthly rate */}
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {b ? `$${parseFloat(b.monthly_rate).toFixed(2)}/mo` : <span className="text-slate-300">—</span>}
                    </td>
                    {/* Billing status */}
                    <td className="px-4 py-3">
                      {bs
                        ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bs.cls}`}>{bs.label}</span>
                        : <span className="text-xs text-slate-300">No record</span>
                      }
                    </td>
                    {/* Bill day */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {b ? ordinal(b.billing_day) : <span className="text-slate-300">—</span>}
                    </td>
                    {/* Next date */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {b ? fmt(b.next_billing_date) : <span className="text-slate-300">—</span>}
                    </td>
                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      {b ? (
                        <button
                          onClick={() => openModal(row, b)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={() => openModal(row, null)}
                          className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium px-2.5 py-1 rounded-lg transition-colors"
                        >
                          + Add Billing
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && modalStudent && (
        <BillingModal
          billing={modalBilling}
          student={modalStudent}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setModalStudent(null); setModalBilling(null) }}
        />
      )}
    </div>
  )
}
