import { useState } from 'react'
import { supabase } from '../lib/supabase'

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && ' *'}</label>
      {children}
    </div>
  )
}

const BELTS    = ['white','yellow','orange','green','blue','red','black']
const PROGRAMS = [
  { value: 'tkd',     label: 'Taekwondo (TKD)' },
  { value: 'asp',     label: 'After School (ASP)' },
  { value: 'tkd_asp', label: 'TKD + ASP' },
]

export default function ConvertLeadModal({ lead, locations, onConverted, onClose }) {
  // Pre-fill student name from child_name if available
  const childParts = (lead.child_name ?? '').trim().split(/\s+/)
  const [form, setForm] = useState({
    student_first_name: childParts[0] ?? '',
    student_last_name:  childParts.length > 1 ? childParts.slice(1).join(' ') : lead.last_name,
    student_dob:        '',
    belt_rank:          'white',
    program:            '',
    location_id:        lead.location_id ?? '',
    trial_start_date:   new Date().toISOString().slice(0, 10),
  })
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(null) // { studentName }
  const [error,   setError]   = useState(null)

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Create the student record
    const { data: student, error: stuErr } = await supabase
      .from('students')
      .insert({
        parent_first_name: lead.first_name,
        parent_last_name:  lead.last_name,
        parent_email:      lead.email   || null,
        parent_phone:      lead.phone   || null,
        student_first_name: form.student_first_name,
        student_last_name:  form.student_last_name,
        student_dob:        form.student_dob || null,
        belt_rank:          form.belt_rank   || null,
        program:            form.program     || null,
        location_id:        form.location_id || null,
        lead_id:            lead.id,
        status:             'trial',
        trial_start_date:   form.trial_start_date || null,
      })
      .select()
      .single()

    if (stuErr) { setError(stuErr.message); setSaving(false); return }

    // Mark lead as converted
    await supabase.from('leads').update({ status: 'converted' }).eq('id', lead.id)

    setSuccess({ studentName: `${form.student_first_name} ${form.student_last_name}` })
    setSaving(false)
    onConverted(lead.id)
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">Conversion complete!</h2>
          <p className="text-slate-500 text-sm mb-2">
            <strong>{success.studentName}</strong> has been added as a trial student.
          </p>
          <p className="text-slate-400 text-xs mb-6">
            The lead is now marked as Converted in the pipeline.
          </p>
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  // ── Conversion form ───────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Convert Lead to Student</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {lead.first_name} {lead.last_name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Parent info preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Parent / Guardian (from lead)</p>
            <p className="text-sm font-medium text-slate-700">{lead.first_name} {lead.last_name}</p>
            <p className="text-xs text-slate-500">
              {[lead.phone, lead.email].filter(Boolean).join(' · ') || 'No contact info'}
            </p>
          </div>

          {/* Student details */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Student Details</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" required>
                  <input required value={form.student_first_name} onChange={e => set('student_first_name', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Last Name" required>
                  <input required value={form.student_last_name} onChange={e => set('student_last_name', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="Date of Birth">
                <input type="date" value={form.student_dob} onChange={e => set('student_dob', e.target.value)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Belt Rank">
                  <select value={form.belt_rank} onChange={e => set('belt_rank', e.target.value)} className={inputCls}>
                    {BELTS.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
                  </select>
                </Field>
                <Field label="Program">
                  <select value={form.program} onChange={e => set('program', e.target.value)} className={inputCls}>
                    <option value="">— Select —</option>
                    {PROGRAMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
              </div>
              {/* Only ask for location if the lead doesn't already have one */}
              {!lead.location_id && (
                <Field label="Location">
                  <select value={form.location_id} onChange={e => set('location_id', e.target.value)} className={inputCls}>
                    <option value="">— Select —</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Trial Start Date">
                <input type="date" value={form.trial_start_date} onChange={e => set('trial_start_date', e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors">
              {saving ? 'Converting…' : '✓ Convert to Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
