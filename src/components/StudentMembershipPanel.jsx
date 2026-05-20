import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const CYCLE_SUFFIX = { weekly: '/wk', biweekly: '/2wk', monthly: '/mo' }
const CATEGORY_LABEL = { afterschool: 'After School', martial_arts: 'Martial Arts', leadership: 'Leadership' }

const STATUS_CLS = {
  active:    'bg-emerald-100 text-emerald-700',
  paused:    'bg-amber-100 text-amber-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

export default function StudentMembershipPanel({ studentId }) {
  const { canEdit } = useAuth()
  const [memberships, setMemberships] = useState([])
  const [allTypes, setAllTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!studentId) return
    loadData()
  }, [studentId])

  async function loadData() {
    setLoading(true)
    const [mRes, tRes] = await Promise.all([
      supabase
        .from('student_memberships')
        .select('*, membership_types(id, name, category, billing_cycle, price)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
      supabase.from('membership_types').select('*').eq('active', true).order('category').order('name'),
    ])
    if (mRes.data) setMemberships(mRes.data)
    if (tRes.data) setAllTypes(tRes.data)
    setLoading(false)
  }

  // Determine which membership slots are taken (active/paused count as held)
  const heldAfterSchool = memberships.some(
    m => m.status !== 'cancelled' && m.membership_types?.category === 'afterschool'
  )
  const heldMartialOrLeadership = memberships.some(
    m => m.status !== 'cancelled' && ['martial_arts', 'leadership'].includes(m.membership_types?.category)
  )

  const availableTypes = allTypes.filter(t => {
    if (t.category === 'afterschool' && heldAfterSchool) return false
    if (['martial_arts', 'leadership'].includes(t.category) && heldMartialOrLeadership) return false
    return true
  })

  async function handleAdd(e) {
    e.preventDefault()
    if (!selectedTypeId) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('student_memberships').insert({
      student_id: studentId,
      membership_type_id: selectedTypeId,
      status: 'active',
      start_date: startDate || null,
      notes: notes || null,
    })
    if (error) {
      setError(error.message)
      setSaving(false)
    } else {
      setShowForm(false)
      setSelectedTypeId('')
      setNotes('')
      setSaving(false)
      loadData()
    }
  }

  async function handleCancel(membershipId) {
    await supabase
      .from('student_memberships')
      .update({ status: 'cancelled' })
      .eq('id', membershipId)
    loadData()
  }

  async function handlePause(membershipId, currentStatus) {
    const next = currentStatus === 'paused' ? 'active' : 'paused'
    await supabase.from('student_memberships').update({ status: next }).eq('id', membershipId)
    loadData()
  }

  const active = memberships.filter(m => m.status !== 'cancelled')

  return (
    <div className="border-t border-slate-200 pt-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Memberships</p>
        {canEdit && !showForm && availableTypes.length > 0 && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            + Add
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <>
          {active.length === 0 && !showForm && (
            <p className="text-xs text-slate-400 italic">No active memberships.</p>
          )}

          <div className="space-y-2">
            {active.map(m => {
              const t = m.membership_types
              return (
                <div key={m.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{t?.name}</p>
                    <p className="text-xs text-slate-400">
                      {CATEGORY_LABEL[t?.category] ?? t?.category}
                      {t && ` · $${t.price}${CYCLE_SUFFIX[t.billing_cycle] ?? ''}`}
                      {m.start_date && ` · started ${new Date(m.start_date).toLocaleDateString()}`}
                    </p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${STATUS_CLS[m.status]}`}>
                    {m.status}
                  </span>
                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePause(m.id, m.status)}
                        className="text-xs text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white"
                      >
                        {m.status === 'paused' ? 'Resume' : 'Pause'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancel(m.id)}
                        className="text-xs text-rose-500 hover:text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 hover:bg-rose-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add form */}
          {showForm && canEdit && (
            <form onSubmit={handleAdd} className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-indigo-700 mb-2">Assign Membership</p>

              {availableTypes.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Both slots are already taken (1 martial arts/leadership + 1 afterschool).
                </p>
              ) : (
                <>
                  <select
                    required
                    value={selectedTypeId}
                    onChange={e => setSelectedTypeId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  >
                    <option value="">— Select type —</option>
                    {['afterschool', 'martial_arts', 'leadership'].map(cat => {
                      const group = availableTypes.filter(t => t.category === cat)
                      if (!group.length) return null
                      return (
                        <optgroup key={cat} label={CATEGORY_LABEL[cat]}>
                          {group.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name} — ${t.price}{CYCLE_SUFFIX[t.billing_cycle] ?? ''}
                            </option>
                          ))}
                        </optgroup>
                      )
                    })}
                  </select>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-600 mb-0.5">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-0.5">Notes</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="optional"
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                  </div>

                  {error && <p className="text-xs text-rose-600">{error}</p>}

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setSelectedTypeId(''); setError(null) }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !selectedTypeId}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1 rounded font-medium"
                    >
                      {saving ? 'Adding…' : 'Add Membership'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </>
      )}
    </div>
  )
}
