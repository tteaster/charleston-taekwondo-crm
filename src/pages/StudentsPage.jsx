import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import StudentCard from '../components/StudentCard'
import StudentModal from '../components/StudentModal'

const STATUS_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'trial',     label: 'Trial' },
  { key: 'active',    label: 'Active' },
  { key: 'paused',    label: 'Paused' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function StudentsPage() {
  const { scopedLocationId, canEdit } = useAuth()
  const [students, setStudents] = useState([])
  const [locations, setLocations] = useState([])
  const [filterLocation, setFilterLocation] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase.from('students').select('*, locations(name)').order('student_last_name', { ascending: true })
    if (scopedLocationId) query = query.eq('location_id', scopedLocationId)
    const { data, error } = await query
    if (error) {
      setError(error.message)
    } else {
      setStudents(data ?? [])
    }
    setLoading(false)
  }, [scopedLocationId])

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('locations').select('*').order('name')
      if (data) setLocations(data)
      await fetchStudents()
    }
    init()
  }, [fetchStudents])

  async function handleSave(payload, studentId) {
    if (studentId) {
      const { data, error } = await supabase
        .from('students')
        .update(payload)
        .eq('id', studentId)
        .select('*, locations(name)')
        .single()
      if (error) throw error
      setStudents(prev => prev.map(s => s.id === studentId ? data : s))
    } else {
      const { data, error } = await supabase
        .from('students')
        .insert(payload)
        .select('*, locations(name)')
        .single()
      if (error) throw error
      setStudents(prev => [...prev, data].sort((a, b) =>
        a.student_last_name.localeCompare(b.student_last_name)
      ))
    }
    setModalOpen(false)
    setEditingStudent(null)
  }

  function openEdit(student) {
    setEditingStudent(student)
    setModalOpen(true)
  }

  function openNew() {
    setEditingStudent(null)
    setModalOpen(true)
  }

  const effectiveLocation = scopedLocationId ?? filterLocation
  const filtered = students.filter(s => {
    if (effectiveLocation !== 'all' && s.location_id !== effectiveLocation) return false
    if (filterStatus !== 'all' && s.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      const studentName = `${s.student_first_name} ${s.student_last_name}`.toLowerCase()
      const parentName = `${s.parent_first_name} ${s.parent_last_name}`.toLowerCase()
      if (!studentName.includes(q) && !parentName.includes(q) && !s.parent_phone?.includes(q)) return false
    }
    return true
  })

  const counts = STATUS_FILTERS.reduce((acc, f) => {
    acc[f.key] = f.key === 'all'
      ? students.length
      : students.filter(s => s.status === f.key).length
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Students</h2>
            <p className="text-xs text-slate-500">{filtered.length} of {students.length} student{students.length !== 1 ? 's' : ''}</p>
          </div>
          {canEdit && (
            <button
              onClick={openNew}
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              + Add Student
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="Search student or parent name, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {!scopedLocationId && (
            <select
              value={filterLocation}
              onChange={e => setFilterLocation(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="all">All Locations</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          )}

          {/* Status tabs */}
          <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
                  filterStatus === f.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
                <span className={`text-xs rounded-full px-1.5 py-0 leading-5 font-medium ${
                  filterStatus === f.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Student grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Loading students…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-rose-600 text-sm">{error}</p>
            <button onClick={fetchStudents} className="text-sm text-indigo-600 hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            {students.length === 0 ? 'No students yet. Add one to get started.' : 'No students match your filters.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(student => (
              <StudentCard
                key={student.id}
                student={student}
                onEdit={() => openEdit(student)}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <StudentModal
          student={editingStudent}
          locations={locations}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingStudent(null) }}
        />
      )}
    </div>
  )
}
