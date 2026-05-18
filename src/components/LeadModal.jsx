import { useState, useEffect } from 'react'

const SOURCES = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'website', label: 'Website' },
  { value: 'facebook_ad', label: 'Facebook Ad' },
  { value: 'instagram_ad', label: 'Instagram Ad' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
]

const STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'trial_scheduled', label: 'Trial Scheduled' },
  { value: 'trial_completed', label: 'Trial Completed' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
]

const EMPTY = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  child_name: '',
  child_age: '',
  source: '',
  source_detail: '',
  location_id: '',
  status: 'new',
  notes: '',
  next_followup_at: '',
  lost_reason: '',
}

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

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

export default function LeadModal({ lead, locations, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (lead) {
      setForm({
        first_name: lead.first_name ?? '',
        last_name: lead.last_name ?? '',
        email: lead.email ?? '',
        phone: lead.phone ?? '',
        child_name: lead.child_name ?? '',
        child_age: lead.child_age ?? '',
        source: lead.source ?? '',
        source_detail: lead.source_detail ?? '',
        location_id: lead.location_id ?? '',
        status: lead.status ?? 'new',
        notes: lead.notes ?? '',
        next_followup_at: lead.next_followup_at ? lead.next_followup_at.slice(0, 10) : '',
        lost_reason: lead.lost_reason ?? '',
      })
    }
  }, [lead])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      child_name: form.child_name || null,
      child_age: form.child_age ? parseInt(form.child_age) : null,
      source: form.source || null,
      source_detail: form.source_detail || null,
      location_id: form.location_id || null,
      status: form.status,
      notes: form.notes || null,
      next_followup_at: form.next_followup_at || null,
      lost_reason: form.status === 'lost' ? form.lost_reason || null : null,
    }
    try {
      await onSave(payload, lead?.id)
    } catch (err) {
      setError(err.message ?? 'Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-slate-800">
            {lead ? 'Edit Lead' : 'Add New Lead'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" required>
              <input required value={form.first_name} onChange={e => set('first_name', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Last Name" required>
              <input required value={form.last_name} onChange={e => set('last_name', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Phone">
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Child's Name">
              <input value={form.child_name} onChange={e => set('child_name', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Child's Age">
              <input type="number" min="1" max="18" value={form.child_age} onChange={e => set('child_age', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <select value={form.source} onChange={e => set('source', e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Source Detail">
              <input
                value={form.source_detail}
                onChange={e => set('source_detail', e.target.value)}
                placeholder="e.g. referral name"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Location">
              <select value={form.location_id} onChange={e => set('location_id', e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          {form.status === 'lost' && (
            <Field label="Lost Reason">
              <input value={form.lost_reason} onChange={e => set('lost_reason', e.target.value)} className={inputCls} />
            </Field>
          )}

          <Field label="Next Follow-up Date">
            <input type="date" value={form.next_followup_at} onChange={e => set('next_followup_at', e.target.value)} className={inputCls} />
          </Field>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </Field>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Saving…' : lead ? 'Save Changes' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
