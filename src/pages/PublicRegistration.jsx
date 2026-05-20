import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${ampm}`
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function PublicRegistration() {
  const { eventId } = useParams()

  const [event,   setEvent]   = useState(null)
  const [series,  setSeries]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Student search (students_only)
  const [studentSearch, setStudentSearch]   = useState('')
  const [studentResults, setStudentResults] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)

  // Open-event form fields
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [notes,     setNotes]     = useState('')

  const [saving,    setSaving]    = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error,     setError]     = useState(null)

  const searchRef = useRef()

  useEffect(() => { loadEvent() }, [eventId])

  // Debounced student search
  useEffect(() => {
    if (!series || series.eligibility !== 'students_only') return
    const t = setTimeout(async () => {
      const q = studentSearch.trim()
      if (q.length < 2) { setStudentResults([]); return }
      const { data } = await supabase
        .from('students')
        .select('id, student_first_name, student_last_name, belt_rank, location_id, locations(name)')
        .or(`student_first_name.ilike.%${q}%,student_last_name.ilike.%${q}%`)
        .limit(8)
      setStudentResults(data ?? [])
    }, 280)
    return () => clearTimeout(t)
  }, [studentSearch, series])

  async function loadEvent() {
    const { data } = await supabase
      .from('events')
      .select('*, locations(name), event_series(id, name, eligibility, price, description, event_type)')
      .eq('id', eventId)
      .maybeSingle()

    if (!data) { setNotFound(true); setLoading(false); return }
    setEvent(data)
    setSeries(data.event_series)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Duplicate check for students_only
    if (selectedStudent) {
      const { data: existing } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('student_id', selectedStudent.id)
        .maybeSingle()
      if (existing) {
        setError(`${selectedStudent.student_first_name} is already registered for this event.`)
        setSaving(false)
        return
      }
    }

    const isStudent = !!selectedStudent
    const payload = {
      event_id:       eventId,
      student_id:     selectedStudent?.id ?? null,
      first_name:     isStudent ? selectedStudent.student_first_name : firstName,
      last_name:      isStudent ? selectedStudent.student_last_name  : lastName,
      email:          email  || null,
      phone:          phone  || null,
      payment_status: 'pending',
      notes:          notes  || null,
    }

    const { error } = await supabase.from('event_registrations').insert(payload)
    if (error) { setError(error.message); setSaving(false) }
    else setSubmitted(true)
  }

  // ── Loading / not found ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || event?.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-700 mb-2">
            {notFound ? 'Event Not Found' : 'Event Cancelled'}
          </p>
          <p className="text-slate-500 text-sm">
            {notFound
              ? 'This registration link is invalid or the event no longer exists.'
              : 'This event has been cancelled. Please contact us for more information.'}
          </p>
        </div>
      </div>
    )
  }

  const price = event.price_override ?? series.price
  const isStudentsOnly = series.eligibility === 'students_only'

  // ── Success screen ─────────────────────────────────────────────────────────

  if (submitted) {
    const regName = selectedStudent
      ? `${selectedStudent.student_first_name} ${selectedStudent.student_last_name}`
      : `${firstName} ${lastName}`
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">You're Registered!</h1>
          <p className="text-slate-500 text-sm mb-6">{regName}</p>
          <div className="bg-slate-50 rounded-xl p-4 text-left text-sm space-y-1">
            <p className="font-semibold text-slate-700">{event.name || series.name}</p>
            <p className="text-slate-500">{fmtDate(event.date)}</p>
            {event.start_time && (
              <p className="text-slate-500">
                {fmtTime(event.start_time)}{event.end_time && ` – ${fmtTime(event.end_time)}`}
              </p>
            )}
            {event.locations?.name && <p className="text-slate-500">{event.locations.name}</p>}
            {price != null && <p className="text-indigo-600 font-medium">${price}</p>}
          </div>
          <p className="text-xs text-slate-400 mt-4">We'll see you there! Contact us if you have any questions.</p>
        </div>
      </div>
    )
  }

  // ── Registration form ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold mx-auto mb-3 shadow">
            CTK
          </div>
          <p className="text-xs text-indigo-600 font-semibold uppercase tracking-widest">Charleston Taekwondo</p>
        </div>

        {/* Event details card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            {series.event_type?.replace(/_/g, ' ')}
          </p>
          <h1 className="text-xl font-bold text-slate-800 mb-1">{event.name || series.name}</h1>
          <div className="space-y-0.5 text-sm text-slate-500">
            <p>{fmtDate(event.date)}</p>
            {event.start_time && (
              <p>{fmtTime(event.start_time)}{event.end_time && ` – ${fmtTime(event.end_time)}`}</p>
            )}
            {event.locations?.name && <p>{event.locations.name}</p>}
            {price != null && (
              <p className="text-indigo-600 font-semibold text-base mt-1">${price}</p>
            )}
          </div>
          {series.description && (
            <p className="mt-3 text-sm text-slate-500 border-t border-slate-100 pt-3">{series.description}</p>
          )}
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">
            {isStudentsOnly ? 'Register a Student' : 'Register'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Students-only: search */}
            {isStudentsOnly ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Search Student *</label>
                {selectedStudent ? (
                  <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-indigo-900">
                        {selectedStudent.student_first_name} {selectedStudent.student_last_name}
                      </p>
                      <p className="text-xs text-indigo-600 capitalize">
                        {selectedStudent.belt_rank ? `${selectedStudent.belt_rank} belt` : ''}
                        {selectedStudent.locations?.name ? ` · ${selectedStudent.locations.name}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedStudent(null); setStudentSearch('') }}
                      className="text-indigo-400 hover:text-indigo-600 text-lg leading-none"
                    >×</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      ref={searchRef}
                      type="search"
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Type student name…"
                      className={inputCls}
                      autoComplete="off"
                    />
                    {studentResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
                        {studentResults.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setSelectedStudent(s); setStudentSearch(''); setStudentResults([]) }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-800">
                                {s.student_first_name} {s.student_last_name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {s.belt_rank ? `${s.belt_rank} belt` : 'No rank'}{s.locations?.name ? ` · ${s.locations.name}` : ''}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Open event: name fields */
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name *</label>
                  <input required value={firstName} onChange={e => setFirstName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name *</label>
                  <input required value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} />
                </div>
              </div>
            )}

            {/* Contact info (both types) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className={`${inputCls} resize-none`} placeholder="Anything we should know?" />
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || (isStudentsOnly && !selectedStudent)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors mt-2"
            >
              {saving ? 'Registering…' : `Register${price != null ? ` — $${price}` : ''}`}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">Charleston Taekwondo · charlestontaekwondo.com</p>
      </div>
    </div>
  )
}
