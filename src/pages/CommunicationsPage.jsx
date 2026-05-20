import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#ef4444','#f97316','#f59e0b','#84cc16','#10b981','#06b6d4',
  '#3b82f6','#6366f1','#8b5cf6','#ec4899','#64748b','#1c1917',
]

// ── Shared helpers ────────────────────────────────────────────────────────────

function TagChip({ tag, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
        selected
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
          : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
      }`}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
      {tag.name}
    </button>
  )
}

function TagSelector({ tags, selectedIds, onChange, recipientCount, loading: rcLoading }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Send To (select tags)</p>
      {tags.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No tags yet — create some in the Tags tab.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map(t => (
            <TagChip
              key={t.id}
              tag={t}
              selected={selectedIds.includes(t.id)}
              onClick={() => onChange(
                selectedIds.includes(t.id)
                  ? selectedIds.filter(id => id !== t.id)
                  : [...selectedIds, t.id]
              )}
            />
          ))}
        </div>
      )}
      {selectedIds.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {rcLoading ? 'Counting recipients…' : (
            <><strong className="text-indigo-600">{recipientCount}</strong> recipient{recipientCount !== 1 ? 's' : ''} estimated</>
          )}
        </p>
      )}
    </div>
  )
}

// ── SMS Tab ───────────────────────────────────────────────────────────────────

function SMSTab({ tags, staff, scopedLocationId, onSent }) {
  const [selectedIds, setSelectedIds]   = useState([])
  const [body,        setBody]          = useState('')
  const [recipientCount, setRC]         = useState(0)
  const [rcLoading,   setRCLoading]     = useState(false)
  const [sending,     setSending]       = useState(false)
  const [sent,        setSent]          = useState(false)
  const [error,       setError]         = useState(null)

  useEffect(() => { computeCount(selectedIds) }, [selectedIds])

  async function computeCount(ids) {
    if (!ids.length) { setRC(0); return }
    setRCLoading(true)
    const [st, lt] = await Promise.all([
      supabase.from('student_tags').select('student_id').in('tag_id', ids),
      supabase.from('lead_tags').select('lead_id').in('tag_id', ids),
    ])
    const students = new Set((st.data ?? []).map(r => r.student_id))
    const leads    = new Set((lt.data ?? []).map(r => r.lead_id))
    setRC(students.size + leads.size)
    setRCLoading(false)
  }

  async function handleSend() {
    if (!body.trim() || !selectedIds.length) return
    setSending(true)
    setError(null)
    const selectedTags = tags.filter(t => selectedIds.includes(t.id))
    const { error } = await supabase.from('communication_logs').insert({
      type: 'sms', body: body.trim(),
      tags_used: selectedTags.map(t => ({ id: t.id, name: t.name, color: t.color })),
      recipient_count: recipientCount,
      sent_by: staff?.id ?? null,
      status: 'sent',
      location_id: scopedLocationId ?? null,
    })
    if (error) { setError(error.message); setSending(false); return }
    setSending(false)
    setSent(true)
    setBody('')
    setSelectedIds([])
    onSent()
    setTimeout(() => setSent(false), 3000)
  }

  const charCount  = body.length
  const segments   = charCount === 0 ? 1 : Math.ceil(charCount / 160)
  const segCap     = segments * 160
  const canSend    = body.trim().length > 0 && selectedIds.length > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Composer */}
      <div className="space-y-5">
        <TagSelector tags={tags} selectedIds={selectedIds} onChange={setSelectedIds}
          recipientCount={recipientCount} loading={rcLoading} />

        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Message</p>
            <span className={`text-xs font-mono ${charCount > segCap - 20 ? 'text-rose-500' : 'text-slate-400'}`}>
              {charCount} / {segCap} · {segments} segment{segments !== 1 ? 's' : ''}
            </span>
          </div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
            placeholder="Type your SMS message here…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>}
        {sent  && <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">✓ Message logged successfully</p>}

        <button
          onClick={handleSend}
          disabled={!canSend || sending}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          {sending ? 'Sending…' : `Send SMS to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Right: Preview */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Preview</p>
        <div className="bg-slate-900 rounded-3xl p-4 pt-6 pb-8 w-72 mx-auto shadow-xl">
          <div className="w-16 h-1 bg-slate-700 rounded-full mx-auto mb-5" />
          <div className="space-y-2">
            <div className="flex justify-end">
              <div className="bg-green-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[85%] leading-relaxed whitespace-pre-wrap">
                {body || <span className="opacity-50">Your message will appear here…</span>}
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-3">
          {charCount} char{charCount !== 1 ? 's' : ''} · {segments} SMS segment{segments !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

// ── Email Tab ─────────────────────────────────────────────────────────────────

function insertFormat(ref, open, close, body, setBody) {
  const ta = ref.current
  if (!ta) return
  const s = ta.selectionStart, e = ta.selectionEnd
  const sel = body.substring(s, e)
  setBody(body.substring(0, s) + open + sel + close + body.substring(e))
  setTimeout(() => { ta.focus(); ta.setSelectionRange(s + open.length, s + open.length + sel.length) }, 0)
}

function EmailTab({ tags, staff, scopedLocationId, onSent }) {
  const bodyRef = useRef()
  const [selectedIds, setSelectedIds] = useState([])
  const [subject,     setSubject]     = useState('')
  const [body,        setBody]        = useState('')
  const [recipientCount, setRC]       = useState(0)
  const [rcLoading,   setRCLoading]   = useState(false)
  const [sending,     setSending]     = useState(false)
  const [sent,        setSent]        = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [error,       setError]       = useState(null)

  useEffect(() => { computeCount(selectedIds) }, [selectedIds])

  async function computeCount(ids) {
    if (!ids.length) { setRC(0); return }
    setRCLoading(true)
    const [st, lt] = await Promise.all([
      supabase.from('student_tags').select('student_id').in('tag_id', ids),
      supabase.from('lead_tags').select('lead_id').in('tag_id', ids),
    ])
    const students = new Set((st.data ?? []).map(r => r.student_id))
    const leads    = new Set((lt.data ?? []).map(r => r.lead_id))
    setRC(students.size + leads.size)
    setRCLoading(false)
  }

  async function handleSend() {
    if (!body.trim() || !selectedIds.length || !subject.trim()) return
    setSending(true)
    setError(null)
    const selectedTags = tags.filter(t => selectedIds.includes(t.id))
    const { error } = await supabase.from('communication_logs').insert({
      type: 'email', subject: subject.trim(), body: body.trim(),
      tags_used: selectedTags.map(t => ({ id: t.id, name: t.name, color: t.color })),
      recipient_count: recipientCount,
      sent_by: staff?.id ?? null,
      status: 'sent',
      location_id: scopedLocationId ?? null,
    })
    if (error) { setError(error.message); setSending(false); return }
    setSending(false)
    setSent(true)
    setBody('')
    setSubject('')
    setSelectedIds([])
    onSent()
    setTimeout(() => setSent(false), 3000)
  }

  const fmt = (open, close) => insertFormat(bodyRef, open, close, body, setBody)
  const canSend = body.trim().length > 0 && subject.trim().length > 0 && selectedIds.length > 0

  return (
    <div className="space-y-5">
      <TagSelector tags={tags} selectedIds={selectedIds} onChange={setSelectedIds}
        recipientCount={recipientCount} loading={rcLoading} />

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Subject *</p>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Email subject line…"
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Body *</p>
          <button
            type="button"
            onClick={() => setShowPreview(p => !p)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {showPreview ? (
          /* Email preview */
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 space-y-1">
              <p className="text-xs text-slate-400">To: <span className="text-slate-600">Recipients of {selectedIds.length > 0 ? tags.filter(t => selectedIds.includes(t.id)).map(t => t.name).join(', ') : 'selected tags'}</span></p>
              <p className="text-xs text-slate-400">Subject: <span className="font-medium text-slate-700">{subject || '(no subject)'}</span></p>
            </div>
            <div
              className="px-5 py-4 text-sm text-slate-700 prose prose-sm max-w-none min-h-24"
              dangerouslySetInnerHTML={{ __html: body || '<em class="text-slate-400">Your email body will appear here…</em>' }}
            />
          </div>
        ) : (
          /* Composer */
          <div className="border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 border-b border-slate-200">
              {[
                { label: 'B', open: '<strong>', close: '</strong>', cls: 'font-bold' },
                { label: 'I', open: '<em>',     close: '</em>',     cls: 'italic'    },
                { label: 'U', open: '<u>',      close: '</u>',      cls: 'underline' },
              ].map(b => (
                <button key={b.label} type="button" onMouseDown={e => { e.preventDefault(); fmt(b.open, b.close) }}
                  className={`w-7 h-7 text-xs border border-slate-300 rounded bg-white hover:bg-slate-100 transition-colors ${b.cls}`}>
                  {b.label}
                </button>
              ))}
              <div className="w-px h-5 bg-slate-300 mx-1" />
              <button type="button" onMouseDown={e => { e.preventDefault(); fmt('<a href="">', '</a>') }}
                className="px-2 h-7 text-xs border border-slate-300 rounded bg-white hover:bg-slate-100 transition-colors text-blue-600">
                Link
              </button>
              <button type="button" onMouseDown={e => { e.preventDefault(); fmt('<ul>\n  <li>', '</li>\n</ul>') }}
                className="px-2 h-7 text-xs border border-slate-300 rounded bg-white hover:bg-slate-100 transition-colors">
                • List
              </button>
            </div>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
              placeholder="Compose your email… (HTML is supported)"
              className="w-full px-3 py-2.5 text-sm resize-none focus:outline-none font-mono"
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>}
      {sent  && <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">✓ Email logged successfully</p>}

      <button
        onClick={handleSend}
        disabled={!canSend || sending}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
      >
        {sending ? 'Sending…' : `Send Email to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}

// ── History Tab ───────────────────────────────────────────────────────────────

const TYPE_CLS = { sms: 'bg-emerald-100 text-emerald-700', email: 'bg-blue-100 text-blue-700' }
const ST_CLS   = { sent: 'bg-emerald-100 text-emerald-700', draft: 'bg-amber-100 text-amber-700', failed: 'bg-rose-100 text-rose-700' }

function HistoryTab({ logs }) {
  const [typeFilter, setTypeFilter] = useState('all')
  const filtered = typeFilter === 'all' ? logs : logs.filter(l => l.type === typeFilter)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-slate-500">{filtered.length} messages</span>
        <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
          {[['all', 'All'], ['sms', 'SMS'], ['email', 'Email']].map(([k, l]) => (
            <button key={k} onClick={() => setTypeFilter(k)}
              className={`px-3 py-1.5 transition-colors ${typeFilter === k ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12 italic">No messages sent yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Sent', 'Type', 'Subject / Preview', 'Tags', 'Recipients', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(log => {
                const tagsUsed = Array.isArray(log.tags_used) ? log.tags_used : []
                return (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.sent_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium uppercase ${TYPE_CLS[log.type]}`}>{log.type}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {log.subject && <p className="font-medium text-slate-700 truncate">{log.subject}</p>}
                      <p className="text-xs text-slate-400 truncate">{log.body?.substring(0, 80)}{(log.body?.length ?? 0) > 80 ? '…' : ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tagsUsed.map(t => (
                          <span key={t.id} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{log.recipient_count}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ST_CLS[log.status]}`}>{log.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tag Members Panel (expandable per-tag) ────────────────────────────────────

function TagMembersPanel({ tag, scopedLocationId }) {
  const [students, setStudents]       = useState([])
  const [leads,    setLeads]          = useState([])
  const [loading,  setLoading]        = useState(true)
  const [sSearch,  setSSearch]        = useState('')
  const [lSearch,  setLSearch]        = useState('')
  const [sResults, setSResults]       = useState([])
  const [lResults, setLResults]       = useState([])

  useEffect(() => { loadMembers() }, [tag.id])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (sSearch.length < 2) { setSResults([]); return }
      let q = supabase.from('students').select('id, student_first_name, student_last_name, locations(name)')
        .or(`student_first_name.ilike.%${sSearch}%,student_last_name.ilike.%${sSearch}%`).limit(6)
      if (scopedLocationId) q = q.eq('location_id', scopedLocationId)
      const { data } = await q
      const memberIds = new Set(students.map(s => s.id))
      setSResults((data ?? []).filter(s => !memberIds.has(s.id)))
    }, 280)
    return () => clearTimeout(t)
  }, [sSearch, students])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (lSearch.length < 2) { setLResults([]); return }
      let q = supabase.from('leads').select('id, first_name, last_name, locations(name)')
        .or(`first_name.ilike.%${lSearch}%,last_name.ilike.%${lSearch}%`).limit(6)
      if (scopedLocationId) q = q.eq('location_id', scopedLocationId)
      const { data } = await q
      const memberIds = new Set(leads.map(l => l.id))
      setLResults((data ?? []).filter(l => !memberIds.has(l.id)))
    }, 280)
    return () => clearTimeout(t)
  }, [lSearch, leads])

  async function loadMembers() {
    setLoading(true)
    const [stRes, ldRes] = await Promise.all([
      supabase.from('student_tags').select('student_id, students(id, student_first_name, student_last_name, locations(name))').eq('tag_id', tag.id),
      supabase.from('lead_tags').select('lead_id, leads(id, first_name, last_name, locations(name))').eq('tag_id', tag.id),
    ])
    setStudents((stRes.data ?? []).map(r => r.students).filter(Boolean))
    setLeads((ldRes.data ?? []).map(r => r.leads).filter(Boolean))
    setLoading(false)
  }

  async function addStudent(student) {
    await supabase.from('student_tags').insert({ student_id: student.id, tag_id: tag.id })
    setStudents(prev => [...prev, student])
    setSSearch(''); setSResults([])
  }

  async function removeStudent(studentId) {
    await supabase.from('student_tags').delete().eq('student_id', studentId).eq('tag_id', tag.id)
    setStudents(prev => prev.filter(s => s.id !== studentId))
  }

  async function addLead(lead) {
    await supabase.from('lead_tags').insert({ lead_id: lead.id, tag_id: tag.id })
    setLeads(prev => [...prev, lead])
    setLSearch(''); setLResults([])
  }

  async function removeLead(leadId) {
    await supabase.from('lead_tags').delete().eq('lead_id', leadId).eq('tag_id', tag.id)
    setLeads(prev => prev.filter(l => l.id !== leadId))
  }

  const searchInputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400'

  return (
    <div className="bg-slate-50 border-t border-slate-200 px-5 py-4">
      {loading ? <p className="text-xs text-slate-400">Loading…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Students */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Students ({students.length})
            </p>
            <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
              {students.length === 0 && <p className="text-xs text-slate-400 italic">None assigned.</p>}
              {students.map(s => (
                <div key={s.id} className="flex items-center gap-2 bg-white rounded px-3 py-1.5 border border-slate-200">
                  <span className="text-xs text-slate-700 flex-1 truncate">{s.student_first_name} {s.student_last_name}</span>
                  <span className="text-xs text-slate-400">{s.locations?.name}</span>
                  <button onClick={() => removeStudent(s.id)} className="text-rose-400 hover:text-rose-600 text-xs shrink-0">✕</button>
                </div>
              ))}
            </div>
            <div className="relative">
              <input type="search" value={sSearch} onChange={e => setSSearch(e.target.value)}
                placeholder="Search students to add…" className={searchInputCls} />
              {sResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                  {sResults.map(s => (
                    <button key={s.id} onClick={() => addStudent(s)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex justify-between">
                      <span className="font-medium">{s.student_first_name} {s.student_last_name}</span>
                      <span className="text-slate-400">{s.locations?.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Leads */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Leads ({leads.length})
            </p>
            <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
              {leads.length === 0 && <p className="text-xs text-slate-400 italic">None assigned.</p>}
              {leads.map(l => (
                <div key={l.id} className="flex items-center gap-2 bg-white rounded px-3 py-1.5 border border-slate-200">
                  <span className="text-xs text-slate-700 flex-1 truncate">{l.first_name} {l.last_name}</span>
                  <span className="text-xs text-slate-400">{l.locations?.name}</span>
                  <button onClick={() => removeLead(l.id)} className="text-rose-400 hover:text-rose-600 text-xs shrink-0">✕</button>
                </div>
              ))}
            </div>
            <div className="relative">
              <input type="search" value={lSearch} onChange={e => setLSearch(e.target.value)}
                placeholder="Search leads to add…" className={searchInputCls} />
              {lResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                  {lResults.map(l => (
                    <button key={l.id} onClick={() => addLead(l)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex justify-between">
                      <span className="font-medium">{l.first_name} {l.last_name}</span>
                      <span className="text-slate-400">{l.locations?.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tags Tab ──────────────────────────────────────────────────────────────────

function TagsTab({ tags, onTagsChange, scopedLocationId, staff }) {
  const [expandedId,   setExpandedId]   = useState(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editingTag,   setEditingTag]   = useState(null)
  const [form,         setForm]         = useState({ name: '', color: PRESET_COLORS[6] })
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,     setDeleting]     = useState(false)

  function openCreate() { setForm({ name: '', color: PRESET_COLORS[6] }); setEditingTag(null); setShowCreate(true); setError(null) }
  function openEdit(tag) { setForm({ name: tag.name, color: tag.color }); setEditingTag(tag); setShowCreate(true); setError(null) }

  async function saveTag(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true); setError(null)
    if (editingTag) {
      const { data, error } = await supabase.from('tags').update({ name: form.name.trim(), color: form.color }).eq('id', editingTag.id).select().single()
      if (error) { setError(error.message); setSaving(false); return }
      onTagsChange(tags.map(t => t.id === editingTag.id ? data : t))
    } else {
      const { data, error } = await supabase.from('tags').insert({ name: form.name.trim(), color: form.color, location_id: scopedLocationId ?? null }).select().single()
      if (error) { setError(error.message); setSaving(false); return }
      onTagsChange([...tags, data])
    }
    setSaving(false); setShowCreate(false); setEditingTag(null)
  }

  async function deleteTag(tag) {
    setDeleting(true)
    await supabase.from('student_tags').delete().eq('tag_id', tag.id)
    await supabase.from('lead_tags').delete().eq('tag_id', tag.id)
    const { error } = await supabase.from('tags').delete().eq('id', tag.id)
    if (error) { setDeleting(false); return }
    onTagsChange(tags.filter(t => t.id !== tag.id))
    setDeleteTarget(null); setDeleting(false)
    if (expandedId === tag.id) setExpandedId(null)
  }

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{tags.length} tag{tags.length !== 1 ? 's' : ''}</p>
        <button onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + New Tag
        </button>
      </div>

      {/* Create/Edit form */}
      {showCreate && (
        <form onSubmit={saveTag} className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-4 space-y-4">
          <p className="text-sm font-semibold text-indigo-800">{editingTag ? 'Edit Tag' : 'New Tag'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tag Name *</label>
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="e.g. Competition Team" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                    className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowCreate(false); setEditingTag(null) }}
              className="text-sm text-slate-600 hover:text-slate-800 px-4 py-1.5">Cancel</button>
            <button type="submit" disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-1.5 rounded-lg">
              {saving ? 'Saving…' : editingTag ? 'Save Changes' : 'Create Tag'}
            </button>
          </div>
        </form>
      )}

      {/* Tag list */}
      {tags.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12 italic">No tags yet. Create one to get started.</p>
      ) : (
        <div className="space-y-2">
          {tags.map(tag => (
            <div key={tag.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Tag row */}
              <div
                onClick={() => setExpandedId(prev => prev === tag.id ? null : tag.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${expandedId === tag.id ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
              >
                <span className="w-4 h-4 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: tag.color }} />
                <span className="font-medium text-slate-800 flex-1">{tag.name}</span>
                {tag.location_id && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">location</span>}
                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(tag)}
                    className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded transition-colors">
                    Edit
                  </button>
                  <button onClick={() => setDeleteTarget(tag)}
                    className="text-xs text-rose-500 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-2.5 py-1 rounded transition-colors">
                    Delete
                  </button>
                </div>
                <span className="text-slate-400 text-xs shrink-0 ml-1">{expandedId === tag.id ? '▲' : '▼'}</span>
              </div>
              {expandedId === tag.id && (
                <TagMembersPanel tag={tag} scopedLocationId={scopedLocationId} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Delete "{deleteTarget.name}"?</h3>
            <p className="text-sm text-slate-500 mb-4">
              This will remove the tag and unassign it from all students and leads. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2 disabled:opacity-50">Cancel</button>
              <button onClick={() => deleteTag(deleteTarget)} disabled={deleting}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'sms',     label: 'SMS' },
  { key: 'email',   label: 'Email' },
  { key: 'history', label: 'History' },
  { key: 'tags',    label: 'Tags' },
]

export default function CommunicationsPage() {
  const { staff, scopedLocationId } = useAuth()
  const [activeTab, setActiveTab] = useState('sms')
  const [tags,      setTags]      = useState([])
  const [logs,      setLogs]      = useState([])
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [tagsRes, logsRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('communication_logs').select('*').order('sent_at', { ascending: false }).limit(200),
    ])
    setTags(tagsRes.data ?? [])
    setLogs(logsRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function refreshLogs() {
    supabase.from('communication_logs').select('*').order('sent_at', { ascending: false }).limit(200)
      .then(({ data }) => setLogs(data ?? []))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Communications</h2>
            <p className="text-xs text-slate-500">{tags.length} tags · {logs.length} messages sent</p>
          </div>
        </div>
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === t.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {t.label}
              {t.key === 'history' && logs.length > 0 && (
                <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0 leading-5 font-medium ${activeTab === t.key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {logs.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {activeTab === 'sms'     && <SMSTab     tags={tags} staff={staff} scopedLocationId={scopedLocationId} onSent={refreshLogs} />}
            {activeTab === 'email'   && <EmailTab   tags={tags} staff={staff} scopedLocationId={scopedLocationId} onSent={refreshLogs} />}
            {activeTab === 'history' && <HistoryTab logs={logs} />}
            {activeTab === 'tags'    && <TagsTab    tags={tags} onTagsChange={setTags} scopedLocationId={scopedLocationId} staff={staff} />}
          </div>
        )}
      </div>
    </div>
  )
}
