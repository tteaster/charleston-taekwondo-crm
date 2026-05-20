import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES = {
  belt_testing:      'Belt Testing',
  parents_night_out: "Parents' Night Out",
  summer_camp:       'Summer Camp',
  day_camp:          'Day Camp',
  skills_camp:       'Skills Camp',
}

const TYPE_COLORS = {
  belt_testing:      'bg-indigo-100 text-indigo-700',
  parents_night_out: 'bg-pink-100 text-pink-700',
  summer_camp:       'bg-amber-100 text-amber-700',
  day_camp:          'bg-teal-100 text-teal-700',
  skills_camp:       'bg-violet-100 text-violet-700',
}

const STATUS_CLS = {
  upcoming:  'bg-amber-100 text-amber-700',
  active:    'bg-emerald-100 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-rose-100 text-rose-600',
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && ' *'}</label>
      {children}
    </div>
  )
}

// ── Shared modal shell ────────────────────────────────────────────────────────

function ModalShell({ title, size = 'md', onClose, children }) {
  const w = size === 'lg' ? 'max-w-2xl' : 'max-w-md'
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`bg-white rounded-xl shadow-xl w-full ${w} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Create Series modal ───────────────────────────────────────────────────────

function CreateSeriesModal({ locations, staffId, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', event_type: 'belt_testing', eligibility: 'open',
    price: '', location_id: '', description: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name:        form.name,
        event_type:  form.event_type,
        eligibility: form.eligibility,
        price:       form.price ? parseFloat(form.price) : null,
        location_id: form.location_id || null,
        description: form.description || null,
        active:      true,
        created_by:  staffId ?? null,
      })
    } catch (err) { setError(err.message); setSaving(false) }
  }

  return (
    <ModalShell title="New Event Series" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Series Name" required>
          <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="e.g. Spring Belt Testing 2026" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Event Type" required>
            <select value={form.event_type} onChange={e => set('event_type', e.target.value)} className={inputCls}>
              {Object.entries(EVENT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Eligibility" required>
            <select value={form.eligibility} onChange={e => set('eligibility', e.target.value)} className={inputCls}>
              <option value="open">Open Registration</option>
              <option value="students_only">Students Only</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default Price ($)">
            <input type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} className={inputCls} placeholder="0.00" />
          </Field>
          <Field label="Default Location">
            <select value={form.location_id} onChange={e => set('location_id', e.target.value)} className={inputCls}>
              <option value="">— Any —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={`${inputCls} resize-none`} />
        </Field>
        {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2">Cancel</button>
          <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
            {saving ? 'Creating…' : 'Create Series'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Create Event modal ────────────────────────────────────────────────────────

function CreateEventModal({ series, locations, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', date: '', start_time: '', end_time: '',
    location_id: series.location_id ?? '',
    capacity: '', price_override: '', status: 'upcoming', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        series_id:      series.id,
        name:           form.name || null,
        date:           form.date,
        start_time:     form.start_time || null,
        end_time:       form.end_time   || null,
        location_id:    form.location_id || null,
        capacity:       form.capacity ? parseInt(form.capacity) : null,
        price_override: form.price_override ? parseFloat(form.price_override) : null,
        status:         form.status,
        notes:          form.notes || null,
      })
    } catch (err) { setError(err.message); setSaving(false) }
  }

  return (
    <ModalShell title={`Add Event Date — ${series.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Event Name">
          <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder={`${series.name} (leave blank to use series name)`} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date" required>
            <input required type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Start Time">
            <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className={inputCls} />
          </Field>
          <Field label="End Time">
            <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <select value={form.location_id} onChange={e => set('location_id', e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Capacity">
            <input type="number" min="1" value={form.capacity} onChange={e => set('capacity', e.target.value)} className={inputCls} placeholder="Unlimited" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price Override ($)">
            <input type="number" min="0" step="0.01" value={form.price_override} onChange={e => set('price_override', e.target.value)} className={inputCls} placeholder={series.price ? `Default: $${series.price}` : 'No default'} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </Field>
        {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2">Cancel</button>
          <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
            {saving ? 'Creating…' : 'Create Event'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Registrations modal ───────────────────────────────────────────────────────

const PAY_CLS = { pending: 'bg-amber-100 text-amber-700', paid: 'bg-emerald-100 text-emerald-700', refunded: 'bg-slate-100 text-slate-600' }

function RegistrationsModal({ event, series, onClose }) {
  const [regs, setRegs]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('event_registrations')
      .select('*')
      .eq('event_id', event.id)
      .order('registered_at', { ascending: true })
      .then(({ data }) => { setRegs(data ?? []); setLoading(false) })
  }, [event.id])

  const eventLabel = event.name || series.name
  const price = event.price_override ?? series.price

  return (
    <ModalShell title={`Registrations — ${eventLabel}`} size="lg" onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500">
          {fmtDate(event.date)}{event.start_time && ` · ${fmtTime(event.start_time)}`}
          {price && ` · $${price}`}
        </div>
        <span className="text-sm font-semibold text-indigo-600">{regs.length} registered</span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
      ) : regs.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No registrations yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                {['Name', 'Email', 'Phone', 'Payment', 'Registered'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regs.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">{r.first_name} {r.last_name}</td>
                  <td className="px-4 py-2 text-slate-600 text-xs">{r.email ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600 text-xs">{r.phone ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PAY_CLS[r.payment_status]}`}>
                      {r.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(r.registered_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${ampm}`
}

async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
}

// ── Series card ───────────────────────────────────────────────────────────────

function SeriesCard({ series, seriesEvents, regCounts, isExpanded, onToggle, canEdit, onAddEvent, onViewRegs }) {
  const [copiedId, setCopiedId] = useState(null)
  const upcoming = seriesEvents.filter(e => e.status === 'upcoming').length

  async function handleCopy(event) {
    const url = `${window.location.origin}/register/${event.id}`
    await copyToClipboard(url)
    setCopiedId(event.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div
        onClick={onToggle}
        className={`flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
      >
        <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${TYPE_COLORS[series.event_type] ?? 'bg-slate-100 text-slate-600'}`}>
          {EVENT_TYPES[series.event_type] ?? series.event_type}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800">{series.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {series.eligibility === 'students_only' ? 'Students Only' : 'Open Registration'}
            {series.price != null && ` · $${series.price}`}
            {series.locations?.name && ` · ${series.locations.name}`}
            <span className={`ml-2 font-medium ${upcoming > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
              {upcoming} upcoming
            </span>
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onAddEvent() }}
            className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0"
          >
            + Add Date
          </button>
        )}
        <span className="text-slate-400 text-xs shrink-0 ml-1">{isExpanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded events */}
      {isExpanded && (
        <div className="border-t border-slate-200">
          {series.description && (
            <p className="px-5 py-3 text-sm text-slate-500 border-b border-slate-100 bg-slate-50 italic">
              {series.description}
            </p>
          )}

          {seriesEvents.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No events yet. Add an event date to get started.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Date', 'Time', 'Location', 'Registered', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {seriesEvents.map(ev => {
                  const count    = regCounts[ev.id] ?? 0
                  const capLabel = ev.capacity ? `${count} / ${ev.capacity}` : `${count}`
                  const price    = ev.price_override ?? series.price
                  return (
                    <tr key={ev.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-700 whitespace-nowrap">{fmtDate(ev.date)}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                        {fmtTime(ev.start_time)}{ev.end_time && ` – ${fmtTime(ev.end_time)}`}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{ev.locations?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-sm font-medium">{capLabel}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[ev.status] ?? ''}`}>
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onViewRegs(ev)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
                          >
                            {count > 0 ? `View ${count} reg${count !== 1 ? 's' : ''}` : 'Registrations'}
                          </button>
                          <button
                            onClick={() => handleCopy(ev)}
                            className={`text-xs px-2 py-0.5 rounded border transition-colors whitespace-nowrap ${
                              copiedId === ev.id
                                ? 'border-emerald-300 text-emerald-600 bg-emerald-50'
                                : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {copiedId === ev.id ? '✓ Copied' : 'Copy Link'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {canEdit && (
            <div className="px-5 py-3 border-t border-slate-100">
              <button
                onClick={onAddEvent}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Add Event Date to {series.name}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const { staff, canEdit, scopedLocationId } = useAuth()
  const [series,    setSeries]    = useState([])
  const [events,    setEvents]    = useState([])
  const [regCounts, setRegCounts] = useState({})
  const [locations, setLocations] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const [createSeriesOpen, setCreateSeriesOpen] = useState(false)
  const [createEventFor,   setCreateEventFor]   = useState(null) // series object
  const [viewRegsFor,      setViewRegsFor]       = useState(null) // { event, series }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [serRes, evRes, regRes, locRes] = await Promise.all([
      supabase.from('event_series').select('*, locations(name)').order('created_at', { ascending: false }),
      supabase.from('events').select('*, locations(name)').order('date', { ascending: true }),
      supabase.from('event_registrations').select('event_id'),
      supabase.from('locations').select('*').order('name'),
    ])
    if (serRes.error) { setError(serRes.error.message); setLoading(false); return }
    setSeries(serRes.data ?? [])
    setLocations(locRes.data ?? [])

    let evs = evRes.data ?? []
    if (scopedLocationId) evs = evs.filter(e => e.location_id === scopedLocationId)
    setEvents(evs)

    const counts = {}
    ;(regRes.data ?? []).forEach(r => { counts[r.event_id] = (counts[r.event_id] ?? 0) + 1 })
    setRegCounts(counts)
    setLoading(false)
  }, [scopedLocationId])

  useEffect(() => { load() }, [load])

  async function handleCreateSeries(payload) {
    const { data, error } = await supabase.from('event_series').insert(payload).select('*, locations(name)').single()
    if (error) throw error
    setSeries(prev => [data, ...prev])
    setCreateSeriesOpen(false)
  }

  async function handleCreateEvent(payload) {
    const { data, error } = await supabase.from('events').insert(payload).select('*, locations(name)').single()
    if (error) throw error
    setEvents(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)))
    setCreateEventFor(null)
    setExpandedId(payload.series_id)
  }

  const totalUpcoming = events.filter(e => e.status === 'upcoming').length

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Events</h2>
            <p className="text-xs text-slate-500">{series.length} series · {totalUpcoming} upcoming events</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setCreateSeriesOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              + New Series
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading events…</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-rose-600 text-sm">{error}</p>
            <button onClick={load} className="text-sm text-indigo-600 hover:underline">Retry</button>
          </div>
        ) : series.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
            <p className="text-sm">No event series yet.</p>
            {canEdit && (
              <button onClick={() => setCreateSeriesOpen(true)} className="text-sm text-indigo-600 hover:underline">
                Create your first series
              </button>
            )}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-4">
            {series.map(s => (
              <SeriesCard
                key={s.id}
                series={s}
                seriesEvents={events.filter(e => e.series_id === s.id)}
                regCounts={regCounts}
                isExpanded={expandedId === s.id}
                onToggle={() => setExpandedId(prev => prev === s.id ? null : s.id)}
                canEdit={canEdit}
                onAddEvent={() => setCreateEventFor(s)}
                onViewRegs={ev => setViewRegsFor({ event: ev, series: s })}
              />
            ))}
          </div>
        )}
      </div>

      {createSeriesOpen && (
        <CreateSeriesModal
          locations={locations}
          staffId={staff?.id}
          onSave={handleCreateSeries}
          onClose={() => setCreateSeriesOpen(false)}
        />
      )}
      {createEventFor && (
        <CreateEventModal
          series={createEventFor}
          locations={locations}
          onSave={handleCreateEvent}
          onClose={() => setCreateEventFor(null)}
        />
      )}
      {viewRegsFor && (
        <RegistrationsModal
          event={viewRegsFor.event}
          series={viewRegsFor.series}
          onClose={() => setViewRegsFor(null)}
        />
      )}
    </div>
  )
}
