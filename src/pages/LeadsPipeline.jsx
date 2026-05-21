import { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
} from '@dnd-kit/core'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import LeadCard from '../components/LeadCard'
import LeadModal from '../components/LeadModal'

export const STATUSES = [
  { key: 'new',             label: 'New',             color: 'bg-slate-500' },
  { key: 'contacted',       label: 'Contacted',       color: 'bg-blue-500' },
  { key: 'trial_scheduled', label: 'Trial Scheduled', color: 'bg-amber-500' },
  { key: 'trial_completed', label: 'Trial Completed', color: 'bg-orange-500' },
  { key: 'converted',       label: 'Converted',       color: 'bg-emerald-500' },
  { key: 'lost',            label: 'Lost',            color: 'bg-rose-500' },
]

// ── Draggable card wrapper ────────────────────────────────────────────────────

function DraggableCard({ lead, statuses, onEdit, onStatusChange, canEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: lead.id,
    data: { status: lead.status },
    disabled: !canEdit,
  })

  // Also register as a drop target so dropping on a card (not just column
  // background) resolves to that card's column status.
  const { setNodeRef: setDropRef } = useDroppable({
    id: `card-${lead.id}`,
    data: { status: lead.status },
    disabled: !canEdit,
  })

  const setRef = (node) => { setDragRef(node); setDropRef(node) }

  return (
    <div
      ref={setRef}
      className={`touch-none ${isDragging ? 'opacity-40' : ''} ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
      {...attributes}
      {...listeners}
    >
      <LeadCard
        lead={lead}
        statuses={statuses}
        onEdit={onEdit}
        onStatusChange={onStatusChange}
      />
    </div>
  )
}

// ── Droppable column body ─────────────────────────────────────────────────────

function DroppableColumn({ statusKey, children, canEdit }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${statusKey}`,
    data: { status: statusKey },
    disabled: !canEdit,
  })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-b-lg p-2 flex-1 space-y-2 min-h-24 transition-colors duration-100 ${
        isOver ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-300' : 'bg-slate-100'
      }`}
    >
      {children}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LeadsPipeline() {
  const { scopedLocationId, canEdit } = useAuth()
  const [leads, setLeads] = useState([])
  const [locations, setLocations] = useState([])
  const [filterLocation, setFilterLocation] = useState('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeId, setActiveId] = useState(null) // id of card being dragged

  // Require 8 px movement before drag activates — prevents accidental drags
  // when clicking the status dropdown or Edit button.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,  { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase.from('leads').select('*, locations(name)').order('created_at', { ascending: false })
    if (scopedLocationId) query = query.eq('location_id', scopedLocationId)
    const { data, error } = await query
    if (error) setError(error.message)
    else setLeads(data ?? [])
    setLoading(false)
  }, [scopedLocationId])

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('locations').select('*').order('name')
      if (data) setLocations(data)
      await fetchLeads()
    }
    init()
  }, [fetchLeads])

  async function updateLeadStatus(leadId, newStatus) {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)
    if (!error) setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
  }

  async function handleSave(payload, leadId) {
    if (leadId) {
      const { data, error } = await supabase.from('leads').update(payload).eq('id', leadId).select('*, locations(name)').single()
      if (error) throw error
      setLeads(prev => prev.map(l => l.id === leadId ? data : l))
    } else {
      const { data, error } = await supabase.from('leads').insert(payload).select('*, locations(name)').single()
      if (error) throw error
      setLeads(prev => [data, ...prev])
    }
    setModalOpen(false)
    setEditingLead(null)
  }

  function openEdit(lead) { setEditingLead(lead); setModalOpen(true) }
  function openNew()       { setEditingLead(null); setModalOpen(true) }

  // ── Drag handlers ────────────────────────────────────────────────────────

  function handleDragStart({ active }) {
    setActiveId(active.id)
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || !canEdit) return

    const targetStatus = over.data.current?.status
    if (!targetStatus) return

    const lead = leads.find(l => l.id === active.id)
    if (!lead || lead.status === targetStatus) return

    updateLeadStatus(active.id, targetStatus)
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const effectiveLocation = scopedLocationId ?? filterLocation
  const filtered = leads.filter(lead => {
    if (effectiveLocation !== 'all' && lead.location_id !== effectiveLocation) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${lead.first_name} ${lead.last_name}`.toLowerCase().includes(q) &&
          !lead.email?.toLowerCase().includes(q) &&
          !lead.phone?.includes(q) &&
          !lead.child_name?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const byStatus = Object.fromEntries(STATUSES.map(s => [s.key, filtered.filter(l => l.status === s.key)]))
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Leads Pipeline</h2>
            <p className="text-xs text-slate-500">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          {canEdit && (
            <button onClick={openNew}
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              + Add Lead
            </button>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          <input type="search" placeholder="Search name, email, phone…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          {!scopedLocationId && (
            <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="all">All Locations</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          )}
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading leads…</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-rose-600 text-sm">{error}</p>
            <button onClick={fetchLeads} className="text-sm text-indigo-600 hover:underline">Retry</button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex gap-4 p-6 min-w-max">
              {STATUSES.map(status => (
                <div key={status.key} className="w-60 flex flex-col">
                  {/* Column header */}
                  <div className={`${status.color} text-white rounded-t-lg px-3 py-2 flex items-center justify-between shrink-0`}>
                    <span className="text-xs font-semibold tracking-wide uppercase">{status.label}</span>
                    <span className="bg-white/25 text-white text-xs font-medium rounded-full px-2 py-0.5 min-w-[1.5rem] text-center">
                      {byStatus[status.key].length}
                    </span>
                  </div>

                  {/* Droppable cards area */}
                  <DroppableColumn statusKey={status.key} canEdit={canEdit}>
                    {byStatus[status.key].length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">No leads</p>
                    )}
                    {byStatus[status.key].map(lead => (
                      <DraggableCard
                        key={lead.id}
                        lead={lead}
                        statuses={STATUSES}
                        canEdit={canEdit}
                        onEdit={() => openEdit(lead)}
                        onStatusChange={newStatus => updateLeadStatus(lead.id, newStatus)}
                      />
                    ))}
                  </DroppableColumn>
                </div>
              ))}
            </div>

            {/* Drag overlay — card floating under cursor */}
            <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
              {activeLead && (
                <div className="rotate-1 scale-105 shadow-2xl cursor-grabbing opacity-95 w-60">
                  <LeadCard
                    lead={activeLead}
                    statuses={STATUSES}
                    onEdit={() => {}}
                    onStatusChange={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {modalOpen && (
        <LeadModal
          lead={editingLead}
          locations={locations}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingLead(null) }}
        />
      )}
    </div>
  )
}
