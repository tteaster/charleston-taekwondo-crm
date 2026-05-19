import { useState, useEffect } from 'react'

const STATUSES = [
  { value: 'current',   label: 'Current' },
  { value: 'past_due',  label: 'Past Due' },
  { value: 'failed',    label: 'Failed' },
  { value: 'paused',    label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
]

const EMPTY = {
  monthly_rate: '',
  billing_day: '1',
  status: 'current',
  next_billing_date: '',
  stripe_customer_id: '',
  stripe_subscription_id: '',
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  )
}

export default function BillingModal({ billing, student, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (billing) {
      setForm({
        monthly_rate:           String(billing.monthly_rate ?? ''),
        billing_day:            String(billing.billing_day ?? '1'),
        status:                 billing.status ?? 'current',
        next_billing_date:      billing.next_billing_date ?? '',
        stripe_customer_id:     billing.stripe_customer_id ?? '',
        stripe_subscription_id: billing.stripe_subscription_id ?? '',
      })
    }
  }, [billing])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      student_id:             student.id,
      monthly_rate:           parseFloat(form.monthly_rate),
      billing_day:            parseInt(form.billing_day),
      status:                 form.status,
      next_billing_date:      form.next_billing_date || null,
      stripe_customer_id:     form.stripe_customer_id || null,
      stripe_subscription_id: form.stripe_subscription_id || null,
    }
    try {
      await onSave(payload, billing?.id)
    } catch (err) {
      setError(err.message ?? 'Failed to save.')
      setSaving(false)
    }
  }

  const studentName = student
    ? `${student.student_first_name} ${student.student_last_name}`
    : ''

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              {billing ? 'Edit Billing' : 'Add Billing Record'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{studentName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly Rate ($)" required>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="150.00"
                value={form.monthly_rate}
                onChange={e => set('monthly_rate', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Billing Day (1–28)" required>
              <input
                required
                type="number"
                min="1"
                max="28"
                value={form.billing_day}
                onChange={e => set('billing_day', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Next Billing Date">
              <input
                type="date"
                value={form.next_billing_date}
                onChange={e => set('next_billing_date', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Stripe (optional)</p>
            <Field label="Customer ID">
              <input
                value={form.stripe_customer_id}
                onChange={e => set('stripe_customer_id', e.target.value)}
                placeholder="cus_..."
                className={inputCls}
              />
            </Field>
            <Field label="Subscription ID">
              <input
                value={form.stripe_subscription_id}
                onChange={e => set('stripe_subscription_id', e.target.value)}
                placeholder="sub_..."
                className={inputCls}
              />
            </Field>
          </div>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Saving…' : billing ? 'Save Changes' : 'Add Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
