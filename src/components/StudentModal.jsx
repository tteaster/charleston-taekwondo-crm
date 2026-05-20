import { useState, useEffect } from 'react'
import StudentMembershipPanel from './StudentMembershipPanel'

const PROGRAMS = [
  { value: 'tkd', label: 'Taekwondo (TKD)' },
  { value: 'asp', label: 'After School Program (ASP)' },
  { value: 'tkd_asp', label: 'TKD + ASP' },
]

const STATUSES = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
]

const BELTS = [
  { value: 'white', label: 'White' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'orange', label: 'Orange' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'red', label: 'Red' },
  { value: 'black', label: 'Black' },
]

const EMPTY = {
  student_first_name: '',
  student_last_name: '',
  parent_first_name: '',
  parent_last_name: '',
  parent_email: '',
  parent_phone: '',
  student_dob: '',
  location_id: '',
  program: '',
  status: 'trial',
  belt_rank: 'white',
  stripe_count: '0',
  enrollment_date: '',
  trial_start_date: '',
  trial_end_date: '',
  notes: '',
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

export default function StudentModal({ student, locations, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (student) {
      setForm({
        student_first_name: student.student_first_name ?? '',
        student_last_name:  student.student_last_name ?? '',
        parent_first_name:  student.parent_first_name ?? '',
        parent_last_name:   student.parent_last_name ?? '',
        parent_email:       student.parent_email ?? '',
        parent_phone:       student.parent_phone ?? '',
        student_dob:        student.student_dob ?? '',
        location_id:        student.location_id ?? '',
        program:            student.program ?? '',
        status:             student.status ?? 'trial',
        belt_rank:          student.belt_rank ?? 'white',
        stripe_count:       String(student.stripe_count ?? 0),
        enrollment_date:    student.enrollment_date ?? '',
        trial_start_date:   student.trial_start_date ?? '',
        trial_end_date:     student.trial_end_date ?? '',
        notes:              student.notes ?? '',
      })
    }
  }, [student])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      student_first_name: form.student_first_name,
      student_last_name:  form.student_last_name,
      parent_first_name:  form.parent_first_name,
      parent_last_name:   form.parent_last_name,
      parent_email:       form.parent_email || null,
      parent_phone:       form.parent_phone || null,
      student_dob:        form.student_dob || null,
      location_id:        form.location_id || null,
      program:            form.program || null,
      status:             form.status,
      belt_rank:          form.belt_rank || null,
      stripe_count:       parseInt(form.stripe_count) || 0,
      enrollment_date:    form.enrollment_date || null,
      trial_start_date:   form.trial_start_date || null,
      trial_end_date:     form.trial_end_date || null,
      notes:              form.notes || null,
    }
    try {
      await onSave(payload, student?.id)
    } catch (err) {
      setError(err.message ?? 'Failed to save. Please try again.')
      setSaving(false)
    }
  }

  const isTrial = form.status === 'trial'

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-slate-800">
            {student ? 'Edit Student' : 'Add New Student'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Student name */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Student</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" required>
                <input required value={form.student_first_name} onChange={e => set('student_first_name', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Last Name" required>
                <input required value={form.student_last_name} onChange={e => set('student_last_name', e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>

          <Field label="Date of Birth">
            <input type="date" value={form.student_dob} onChange={e => set('student_dob', e.target.value)} className={inputCls} />
          </Field>

          {/* Parent info */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Parent / Guardian</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="First Name" required>
                <input required value={form.parent_first_name} onChange={e => set('parent_first_name', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Last Name" required>
                <input required value={form.parent_last_name} onChange={e => set('parent_last_name', e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input type="tel" value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Email">
                <input type="email" value={form.parent_email} onChange={e => set('parent_email', e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>

          {/* Enrollment */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Enrollment</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Location">
                <select value={form.location_id} onChange={e => set('location_id', e.target.value)} className={inputCls}>
                  <option value="">— Select —</option>
                  {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                </select>
              </Field>
              <Field label="Program">
                <select value={form.program} onChange={e => set('program', e.target.value)} className={inputCls}>
                  <option value="">— Select —</option>
                  {PROGRAMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Enrollment Date">
                <input type="date" value={form.enrollment_date} onChange={e => set('enrollment_date', e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>

          {/* Trial dates — only shown for trial status */}
          {isTrial && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Trial Start">
                <input type="date" value={form.trial_start_date} onChange={e => set('trial_start_date', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Trial End">
                <input type="date" value={form.trial_end_date} onChange={e => set('trial_end_date', e.target.value)} className={inputCls} />
              </Field>
            </div>
          )}

          {/* Progress */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Progress</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Belt Rank">
                <select value={form.belt_rank} onChange={e => set('belt_rank', e.target.value)} className={inputCls}>
                  <option value="">— Select —</option>
                  {BELTS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </Field>
              <Field label="Stripes (0–4)">
                <select value={form.stripe_count} onChange={e => set('stripe_count', e.target.value)} className={inputCls}>
                  {[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </Field>

          {/* Memberships — only when editing an existing student */}
          {student?.id && <StudentMembershipPanel studentId={student.id} />}

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
              {saving ? 'Saving…' : student ? 'Save Changes' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
