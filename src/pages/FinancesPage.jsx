import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const STATUS_CLS = {
  paid:     'bg-emerald-100 text-emerald-700',
  pending:  'bg-amber-100 text-amber-700',
  failed:   'bg-rose-100 text-rose-700',
  refunded: 'bg-slate-100 text-slate-600',
}

const METHOD_CLS = {
  cash:   'bg-teal-100 text-teal-700',
  check:  'bg-blue-100 text-blue-700',
  card:   'bg-indigo-100 text-indigo-700',
  stripe: 'bg-violet-100 text-violet-700',
}

function fmt$(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
}

function startOfMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10)
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

const STATUS_FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'paid',     label: 'Paid' },
  { key: 'pending',  label: 'Pending' },
  { key: 'failed',   label: 'Failed' },
  { key: 'refunded', label: 'Refunded' },
]

export default function FinancesPage() {
  const { scopedLocationId } = useAuth()
  const [payments,   setPayments]   = useState([])
  const [pastDue,    setPastDue]    = useState(0)
  const [locations,  setLocations]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  // Filters
  const [search,      setSearch]      = useState('')
  const [locFilter,   setLocFilter]   = useState('all')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [payRes, billingRes, locRes] = await Promise.all([
      supabase
        .from('payments')
        .select('*, students(student_first_name, student_last_name, location_id, locations(name))')
        .order('payment_date', { ascending: false })
        .limit(1000),
      supabase
        .from('billing')
        .select('id', { count: 'exact' })
        .in('status', ['past_due', 'failed']),
      supabase.from('locations').select('*').order('name'),
    ])
    if (payRes.error) { setError(payRes.error.message); setLoading(false); return }
    setPayments(payRes.data ?? [])
    setPastDue(billingRes.count ?? 0)
    setLocations(locRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Apply scope + filters ──────────────────────────────────────────────────
  const scoped = scopedLocationId
    ? payments.filter(p => p.students?.location_id === scopedLocationId)
    : payments

  const som = startOfMonth()
  const thisMonthPaid    = scoped.filter(p => p.status === 'paid'    && p.payment_date >= som)
  const thisMonthRevenue = thisMonthPaid.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const pendingTotal     = scoped.filter(p => p.status === 'pending').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)

  const filtered = scoped.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (!scopedLocationId && locFilter !== 'all' && p.students?.location_id !== locFilter) return false
    if (dateFrom && (p.payment_date ?? '') < dateFrom) return false
    if (dateTo   && (p.payment_date ?? '') > dateTo)   return false
    if (search) {
      const q = search.toLowerCase()
      const name = `${p.students?.student_first_name} ${p.students?.student_last_name}`.toLowerCase()
      if (!name.includes(q)) return false
    }
    return true
  })

  const statusCounts = STATUS_FILTERS.reduce((acc, f) => {
    acc[f.key] = f.key === 'all' ? scoped.length : scoped.filter(p => p.status === f.key).length
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="mb-5">
          <h2 className="text-base font-bold text-slate-800">Finances</h2>
          <p className="text-xs text-slate-500">{scoped.length} payment records</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard label="Revenue This Month"   value={fmt$(thisMonthRevenue)} sub={`${thisMonthPaid.length} paid payments`} accent="text-emerald-600" />
          <StatCard label="Past Due Accounts"    value={pastDue}  sub="billing status: past due / failed" accent={pastDue > 0 ? 'text-rose-600' : 'text-slate-800'} />
          <StatCard label="Payments This Month"  value={thisMonthPaid.length} sub="status: paid" />
          <StatCard label="Pending / Outstanding" value={fmt$(pendingTotal)} sub={`${scoped.filter(p => p.status === 'pending').length} pending`} accent={pendingTotal > 0 ? 'text-amber-600' : 'text-slate-800'} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="Search student name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {!scopedLocationId && (
            <select value={locFilter} onChange={e => setLocFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="all">All Locations</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <span className="text-slate-400 text-sm">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />

          {/* Status tabs */}
          <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
            {STATUS_FILTERS.map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
                  statusFilter === f.key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}>
                {f.label}
                <span className={`text-xs rounded-full px-1.5 leading-5 font-medium ${statusFilter === f.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {statusCounts[f.key]}
                </span>
              </button>
            ))}
          </div>

          {(search || locFilter !== 'all' || dateFrom || dateTo || statusFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setLocFilter('all'); setDateFrom(''); setDateTo(''); setStatusFilter('all') }}
              className="text-xs text-slate-400 hover:text-slate-600 underline">Clear filters</button>
          )}
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading payments…</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-rose-600 text-sm">{error}</p>
            <button onClick={load} className="text-sm text-indigo-600 hover:underline">Retry</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                {['Date', 'Student', 'Location', 'Amount', 'Method', 'Status', 'Notes'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-400 text-sm py-12">No payments match your filters.</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.payment_date ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                    {p.students?.student_first_name} {p.students?.student_last_name}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{p.students?.locations?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{fmt$(p.amount)}</td>
                  <td className="px-4 py-3">
                    {p.method && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${METHOD_CLS[p.method] ?? 'bg-slate-100 text-slate-600'}`}>
                        {p.method}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-48 truncate">{p.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
