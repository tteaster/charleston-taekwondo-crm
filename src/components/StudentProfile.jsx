import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${ampm}`
}

const BELT_CLS = {
  white: 'bg-gray-200 text-gray-700', yellow: 'bg-yellow-400 text-yellow-900',
  orange: 'bg-orange-400 text-orange-900', green: 'bg-green-500 text-white',
  blue: 'bg-blue-500 text-white', red: 'bg-red-600 text-white', black: 'bg-gray-900 text-white',
}
const STATUS_CLS = {
  trial: 'bg-amber-100 text-amber-700', active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-slate-100 text-slate-600', cancelled: 'bg-rose-100 text-rose-600',
}
const PAY_STATUS_CLS = {
  paid: 'bg-emerald-100 text-emerald-700', pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-rose-100 text-rose-700', refunded: 'bg-slate-100 text-slate-600',
}
const METHOD_CLS = {
  cash: 'bg-teal-100 text-teal-700', check: 'bg-blue-100 text-blue-700',
  card: 'bg-indigo-100 text-indigo-700', stripe: 'bg-violet-100 text-violet-700',
}
const CYCLE_SUFFIX = { weekly: '/wk', biweekly: '/2wk', monthly: '/mo' }

// ── Record Payment modal ──────────────────────────────────────────────────────

function RecordPaymentModal({ student, billingId, onClose, onSaved }) {
  const [form, setForm] = useState({
    amount: '', payment_date: new Date().toISOString().slice(0, 10),
    method: 'cash', status: 'paid', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!billingId) { setError('No billing record found. Create one on the Billing page first.'); return }
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('payments').insert({
      billing_id:   billingId,
      student_id:   student.id,
      amount:       parseFloat(form.amount),
      payment_date: form.payment_date,
      method:       form.method,
      status:       form.status,
      notes:        form.notes || null,
    })
    if (error) { setError(error.message); setSaving(false) }
    else { onSaved(); onClose() }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">Record Payment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($) *</label>
              <input required type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input required type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
              <select value={form.method} onChange={e => set('method', e.target.value)} className={inputCls}>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="card">Card</option>
                <option value="stripe">Stripe</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes (what it's for)</label>
            <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} placeholder="e.g. April tuition" />
          </div>
          {!billingId && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠ No billing record found. Go to Billing → Add Billing for this student first.
            </p>
          )}
          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving || !billingId}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
              {saving ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StudentProfile({ student, onClose, onEdit }) {
  const { canEdit } = useAuth()

  const [memberships, setMemberships]   = useState([])
  const [payments,    setPayments]      = useState([])
  const [eventPay,    setEventPay]      = useState([])
  const [attendance,  setAttendance]    = useState([])
  const [billingId,   setBillingId]     = useState(null)
  const [totalPoints, setTotalPoints]   = useState(0)
  const [monthlyPts,  setMonthlyPts]    = useState(0)
  const [monthlyRank, setMonthlyRank]   = useState(null)
  const [loading,     setLoading]       = useState(true)
  const [showPayModal, setShowPayModal] = useState(false)

  const fullName = `${student.student_first_name} ${student.student_last_name}`
  const initials = `${student.student_first_name[0]}${student.student_last_name[0]}`.toUpperCase()

  useEffect(() => { loadAll() }, [student.id])

  async function loadAll() {
    setLoading(true)

    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

    const [membRes, payRes, evtPayRes, attRes, billRes, pointsRes, allMonthlyRes] = await Promise.all([
      supabase.from('student_memberships')
        .select('*, membership_types(name, category, billing_cycle, price)')
        .eq('student_id', student.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase.from('payments')
        .select('*')
        .eq('student_id', student.id)
        .order('payment_date', { ascending: false })
        .limit(100),
      supabase.from('event_registrations')
        .select('id, amount_paid, payment_status, registered_at, notes, events(name, date, event_series(name))')
        .eq('student_id', student.id)
        .not('amount_paid', 'is', null),
      supabase.from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .order('checked_in_at', { ascending: false })
        .limit(100),
      supabase.from('billing')
        .select('id')
        .eq('student_id', student.id)
        .maybeSingle(),
      supabase.from('points_log')
        .select('points, awarded_at')
        .eq('student_id', student.id),
      supabase.from('points_log')
        .select('student_id, points')
        .gte('awarded_at', startOfMonth.toISOString()),
    ])

    setMemberships(membRes.data ?? [])
    setPayments(payRes.data ?? [])
    setEventPay(evtPayRes.data ?? [])
    setAttendance(attRes.data ?? [])
    setBillingId(billRes.data?.id ?? null)

    const pts = (pointsRes.data ?? []).reduce((s, p) => s + p.points, 0)
    setTotalPoints(pts)

    // Monthly points + rank
    const monthStart = startOfMonth.toISOString()
    const myMonthly = (pointsRes.data ?? [])
      .filter(p => p.awarded_at >= monthStart)
      .reduce((s, p) => s + p.points, 0)
    setMonthlyPts(myMonthly)

    const allByStudent = {}
    ;(allMonthlyRes.data ?? []).forEach(p => {
      allByStudent[p.student_id] = (allByStudent[p.student_id] ?? 0) + p.points
    })
    const sorted = Object.entries(allByStudent).sort((a, b) => b[1] - a[1])
    const rank = sorted.findIndex(([id]) => id === student.id) + 1
    setMonthlyRank(rank > 0 ? rank : null)

    setLoading(false)
  }

  // Merge billing + event payments by date
  const allPayments = [
    ...(payments.map(p => ({
      id: p.id, date: p.payment_date, amount: p.amount,
      status: p.status, method: p.method,
      description: p.notes || 'Monthly Billing', type: 'billing',
    }))),
    ...(eventPay.filter(r => r.amount_paid > 0).map(r => ({
      id: r.id, date: r.registered_at?.slice(0, 10), amount: r.amount_paid,
      status: r.payment_status, method: null,
      description: r.events?.name || r.events?.event_series?.name || 'Event Registration',
      type: 'event',
    }))),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  const totalRevenue = allPayments.filter(p => p.status === 'paid').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)

  return (
    <div className="fixed inset-0 bg-slate-100 z-40 overflow-y-auto">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium">
          ← Back
        </button>
        <span className="text-slate-300">|</span>
        <span className="text-sm font-semibold text-slate-700 flex-1 truncate">{fullName}</span>
        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <button onClick={() => setShowPayModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
              + Record Payment
            </button>
          )}
          {canEdit && (
            <button onClick={() => onEdit(student)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
              Edit Student
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Identity card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-start gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 text-2xl font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-slate-800">{fullName}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[student.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {student.status}
              </span>
              {student.belt_rank && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BELT_CLS[student.belt_rank] ?? 'bg-gray-200 text-gray-700'}`}>
                  {student.belt_rank.charAt(0).toUpperCase() + student.belt_rank.slice(1)} Belt
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {student.locations?.name && <span>{student.locations.name}</span>}
              {student.student_dob && <span className="ml-3">DOB: {fmtDate(student.student_dob)}</span>}
              {student.enrollment_date && <span className="ml-3">Enrolled: {fmtDate(student.enrollment_date)}</span>}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">
              {student.parent_first_name} {student.parent_last_name}
              {student.parent_phone && <span className="ml-3">{student.parent_phone}</span>}
              {student.parent_email && <span className="ml-3">{student.parent_email}</span>}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Check-ins',    value: attendance.length,      accent: 'text-indigo-600' },
            { label: 'Lifetime Points',    value: totalPoints.toLocaleString(), accent: 'text-indigo-600' },
            { label: 'Points This Month',  value: monthlyPts.toLocaleString(), accent: 'text-emerald-600' },
            { label: 'Monthly Rank',       value: monthlyRank ? `#${monthlyRank}` : '—', accent: monthlyRank && monthlyRank <= 3 ? 'text-amber-500' : 'text-slate-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.accent}`}>{loading ? '…' : s.value}</p>
            </div>
          ))}
        </div>

        {/* Active memberships */}
        <Section title="Active Memberships">
          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : memberships.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No active memberships.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {memberships.map(m => {
                const t = m.membership_types
                return (
                  <div key={m.id} className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-indigo-900">{t?.name}</p>
                    <p className="text-xs text-indigo-600">
                      ${t?.price}{CYCLE_SUFFIX[t?.billing_cycle] ?? ''}
                      {m.start_date && ` · since ${fmtDate(m.start_date)}`}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        {/* Payment history */}
        <Section title={`Payment History — ${fmt$(totalRevenue)} total paid`}>
          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : allPayments.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No payment records.</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    {['Date', 'Description', 'Amount', 'Method', 'Status'].map(h => (
                      <th key={h} className="px-5 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allPayments.map(p => (
                    <tr key={`${p.type}-${p.id}`} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">{fmtDate(p.date)}</td>
                      <td className="px-5 py-2.5 text-slate-700">
                        {p.description}
                        {p.type === 'event' && <span className="ml-1 text-xs text-slate-400">· event</span>}
                      </td>
                      <td className="px-5 py-2.5 font-semibold text-slate-700">{fmt$(p.amount)}</td>
                      <td className="px-5 py-2.5">
                        {p.method ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${METHOD_CLS[p.method] ?? 'bg-slate-100 text-slate-600'}`}>
                            {p.method}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAY_STATUS_CLS[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Attendance history */}
        <Section title={`Attendance History — ${attendance.length} check-in${attendance.length !== 1 ? 's' : ''}`}>
          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : attendance.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No attendance records.</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    {['Date', 'Class', 'Time', 'Points'].map(h => (
                      <th key={h} className="px-5 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendance.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">{fmtDate(a.class_date)}</td>
                      <td className="px-5 py-2.5 text-slate-700">{a.class_type ?? '—'}</td>
                      <td className="px-5 py-2.5 text-slate-500 text-xs">{a.class_time ?? '—'}</td>
                      <td className="px-5 py-2.5 text-emerald-600 font-semibold text-xs">+{a.points_awarded ?? 10}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Notes */}
        {student.notes && (
          <Section title="Notes">
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{student.notes}</p>
          </Section>
        )}
      </div>

      {showPayModal && (
        <RecordPaymentModal
          student={student}
          billingId={billingId}
          onClose={() => setShowPayModal(false)}
          onSaved={loadAll}
        />
      )}
    </div>
  )
}
