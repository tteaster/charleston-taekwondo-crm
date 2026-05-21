import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const CAT_COLORS = {
  uniform:   'bg-indigo-100 text-indigo-700',
  apparel:   'bg-pink-100 text-pink-700',
  equipment: 'bg-amber-100 text-amber-700',
  other:     'bg-slate-100 text-slate-600',
}
const CAT_LABELS = { uniform: 'Uniform', apparel: 'Apparel', equipment: 'Equipment', other: 'Other' }
const PAY_LABELS  = { cash: 'Cash', card: 'Card', check: 'Check' }

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

function fmt$(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Stock badge ───────────────────────────────────────────────────────────────

function StockBadge({ item }) {
  if (!item.track_inventory) return null
  const qty = item.quantity_in_stock ?? 0
  if (qty === 0) return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-rose-100 text-rose-700">Out of stock</span>
  if (qty <= 5)  return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">{qty} left — low</span>
  return              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">{qty} in stock</span>
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({ item, onEdit, onRecordSale, canEdit }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow ${!item.active ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${CAT_COLORS[item.category]}`}>
          {CAT_LABELS[item.category]}
        </span>
        {!item.active && (
          <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">Inactive</span>
        )}
      </div>

      <div className="flex-1">
        <p className="font-semibold text-slate-800 leading-tight">{item.name}</p>
        {item.description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-bold text-slate-800">{fmt$(item.price)}</p>
        <StockBadge item={item} />
      </div>

      <div className="text-xs text-slate-400 space-y-0.5">
        {item.sku   && <p>SKU: {item.sku}</p>}
        {item.cost  && <p>Cost: {fmt$(item.cost)}</p>}
        {item.locations?.name
          ? <p>📍 {item.locations.name}</p>
          : <p>All locations</p>}
      </div>

      {canEdit && (
        <div className="flex gap-2 pt-2 border-t border-slate-100 mt-auto">
          <button onClick={onEdit}
            className="flex-1 text-xs border border-slate-300 hover:bg-slate-50 text-slate-600 py-1.5 rounded-lg transition-colors font-medium">
            Edit
          </button>
          <button onClick={onRecordSale} disabled={item.track_inventory && (item.quantity_in_stock ?? 0) === 0}
            className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white py-1.5 rounded-lg transition-colors font-medium">
            Record Sale
          </button>
        </div>
      )}
    </div>
  )
}

// ── Add / Edit item modal ─────────────────────────────────────────────────────

function AddEditItemModal({ item, locations, scopedLocationId, staff, onSave, onClose }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    name:             item?.name             ?? '',
    description:      item?.description      ?? '',
    category:         item?.category         ?? 'uniform',
    price:            item?.price != null    ? String(item.price) : '',
    cost:             item?.cost  != null    ? String(item.cost)  : '',
    sku:              item?.sku              ?? '',
    track_inventory:  item?.track_inventory  ?? false,
    quantity_in_stock: item?.quantity_in_stock != null ? String(item.quantity_in_stock) : '',
    location_id:      item?.location_id      ?? (scopedLocationId ?? ''),
    active:           item?.active           ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      name:             form.name,
      description:      form.description || null,
      category:         form.category,
      price:            parseFloat(form.price),
      cost:             form.cost   ? parseFloat(form.cost)  : null,
      sku:              form.sku    || null,
      track_inventory:  form.track_inventory,
      quantity_in_stock: form.track_inventory && form.quantity_in_stock !== ''
        ? parseInt(form.quantity_in_stock) : null,
      location_id:      form.location_id || null,
      active:           form.active,
    }
    try { await onSave(payload, item?.id) }
    catch (err) { setError(err.message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit Item' : 'Add Item'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="e.g. WTF Competition Uniform" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
                {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">SKU</label>
              <input value={form.sku} onChange={e => set('sku', e.target.value)} className={inputCls} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Price ($) *</label>
              <input required type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cost ($)</label>
              <input type="number" min="0" step="0.01" value={form.cost} onChange={e => set('cost', e.target.value)} className={inputCls} placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
            <select value={form.location_id} onChange={e => set('location_id', e.target.value)} className={inputCls}>
              <option value="">All Locations (no restriction)</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {/* Track inventory */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.track_inventory}
              onChange={e => set('track_inventory', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
            <span className="text-sm text-slate-700 font-medium">Track inventory quantity</span>
          </label>
          {form.track_inventory && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {isEdit ? 'Current Quantity' : 'Starting Quantity'}
              </label>
              <input type="number" min="0" value={form.quantity_in_stock}
                onChange={e => set('quantity_in_stock', e.target.value)} className={inputCls} placeholder="0" />
            </div>
          )}
          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.active}
                onChange={e => set('active', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
              <span className="text-sm text-slate-700 font-medium">Active (visible on inventory)</span>
            </label>
          )}
          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Record sale modal ─────────────────────────────────────────────────────────

function RecordSaleModal({ item, locations, scopedLocationId, staff, onSave, onClose }) {
  const searchRef = useRef()
  const [qty,       setQty]       = useState('1')
  const [unitPrice, setUnitPrice] = useState(String(item.price))
  const [payMethod, setPayMethod] = useState('cash')
  const [locId,     setLocId]     = useState(scopedLocationId ?? '')
  const [notes,     setNotes]     = useState('')
  const [student,   setStudent]   = useState(null)
  const [search,    setSearch]    = useState('')
  const [results,   setResults]   = useState([])
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  const total = (parseFloat(qty) || 0) * (parseFloat(unitPrice) || 0)
  const willDeplete = item.track_inventory &&
    (item.quantity_in_stock ?? 0) - (parseInt(qty) || 0) < 0

  useEffect(() => {
    const t = setTimeout(async () => {
      if (search.length < 2) { setResults([]); return }
      const { data } = await supabase.from('students')
        .select('id, student_first_name, student_last_name, locations(name)')
        .or(`student_first_name.ilike.%${search}%,student_last_name.ilike.%${search}%`)
        .limit(6)
      setResults(data ?? [])
    }, 280)
    return () => clearTimeout(t)
  }, [search])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        retail_item_id: item.id,
        student_id:     student?.id ?? null,
        location_id:    locId || null,
        quantity:       parseInt(qty),
        unit_price:     parseFloat(unitPrice),
        total,
        payment_method: payMethod,
        notes:          notes || null,
        sold_by:        staff?.id ?? null,
      }, item)
    } catch (err) { setError(err.message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Record Sale</h2>
            <p className="text-xs text-slate-500 mt-0.5">{item.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
              <input required type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unit Price</label>
              <input required type="number" min="0" step="0.01" value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Total</label>
              <div className="flex items-center h-[38px] border border-slate-200 rounded-lg bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                {fmt$(total)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputCls}>
                {Object.entries(PAY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {!scopedLocationId && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                <select value={locId} onChange={e => setLocId(e.target.value)} className={inputCls}>
                  <option value="">— Select —</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Optional student */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Student (optional)</label>
            {student ? (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                <span className="flex-1 text-sm font-medium text-indigo-800">
                  {student.student_first_name} {student.student_last_name}
                </span>
                <button type="button" onClick={() => { setStudent(null); setSearch('') }}
                  className="text-indigo-400 hover:text-indigo-600 text-lg leading-none">×</button>
              </div>
            ) : (
              <div className="relative">
                <input ref={searchRef} type="search" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name…" className={inputCls} autoComplete="off" />
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
                    {results.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { setStudent(s); setSearch(''); setResults([]) }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex justify-between">
                        <span className="font-medium">{s.student_first_name} {s.student_last_name}</span>
                        <span className="text-xs text-slate-400">{s.locations?.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className={inputCls} placeholder="Optional" />
          </div>

          {item.track_inventory && (
            <div className={`text-xs rounded-lg px-3 py-2 border ${willDeplete
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              {willDeplete
                ? `⚠ This sale would exceed current stock (${item.quantity_in_stock} in stock)`
                : `Stock after sale: ${(item.quantity_in_stock ?? 0) - (parseInt(qty) || 0)}`}
            </div>
          )}

          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
              {saving ? 'Recording…' : `Record Sale · ${fmt$(total)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Inventory tab ─────────────────────────────────────────────────────────────

const CAT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'uniform', label: 'Uniforms' },
  { key: 'apparel', label: 'Apparel' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'other', label: 'Other' },
]

function InventoryTab({ locations, scopedLocationId, staff, canEdit, externalAddOpen = false, onExternalAddClose = () => {} }) {
  const [items,        setItems]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [catFilter,    setCatFilter]    = useState('all')
  const [locFilter,    setLocFilter]    = useState('all')
  const [showInactive, setShowInactive] = useState(false)
  const [editingItem,  setEditingItem]  = useState(null)
  const [localAddOpen, setLocalAddOpen] = useState(false)
  const [saleItem,     setSaleItem]     = useState(null)

  const showAddModal = externalAddOpen || localAddOpen
  function closeAddModal() { setLocalAddOpen(false); onExternalAddClose() }

  const fetchItems = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('retail_items').select('*, locations(name)')
    // Location scoping
    if (scopedLocationId) {
      q = q.or(`location_id.eq.${scopedLocationId},location_id.is.null`)
    } else if (locFilter !== 'all') {
      q = q.or(`location_id.eq.${locFilter},location_id.is.null`)
    }
    if (catFilter !== 'all') q = q.eq('category', catFilter)
    if (!showInactive) q = q.eq('active', true)
    q = q.order('name')
    const { data } = await q
    setItems(data ?? [])
    setLoading(false)
  }, [scopedLocationId, locFilter, catFilter, showInactive])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function handleSaveItem(payload, itemId) {
    if (itemId) {
      const { error } = await supabase.from('retail_items').update(payload).eq('id', itemId)
      if (error) throw error
    } else {
      const { error } = await supabase.from('retail_items').insert(payload)
      if (error) throw error
    }
    setEditingItem(null)
    closeAddModal()
    fetchItems()
  }

  async function handleSale(saleData, item) {
    const { error } = await supabase.from('retail_sales').insert(saleData)
    if (error) throw error
    // Decrement inventory if tracked
    if (item.track_inventory) {
      const newQty = (item.quantity_in_stock ?? 0) - saleData.quantity
      await supabase.from('retail_items').update({ quantity_in_stock: newQty }).eq('id', item.id)
    }
    setSaleItem(null)
    fetchItems()
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
          {CAT_FILTERS.map(f => (
            <button key={f.key} onClick={() => setCatFilter(f.key)}
              className={`px-3 py-1.5 transition-colors ${catFilter === f.key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {!scopedLocationId && (
          <select value={locFilter} onChange={e => setLocFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="all">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
          Show inactive
        </label>
        <span className="text-xs text-slate-400 ml-auto">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading inventory…</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
          <p className="text-sm">No items found.</p>
          {canEdit && (
            <button onClick={() => setLocalAddOpen(true)} className="text-sm text-indigo-600 hover:underline">Add your first item</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              onEdit={() => setEditingItem(item)}
              onRecordSale={() => setSaleItem(item)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {(showAddModal || editingItem) && (
        <AddEditItemModal
          item={editingItem ?? null}
          locations={locations}
          scopedLocationId={scopedLocationId}
          staff={staff}
          onSave={handleSaveItem}
          onClose={() => { setEditingItem(null); closeAddModal() }}
        />
      )}
      {saleItem && (
        <RecordSaleModal
          item={saleItem}
          locations={locations}
          scopedLocationId={scopedLocationId}
          staff={staff}
          onSave={handleSale}
          onClose={() => setSaleItem(null)}
        />
      )}
    </div>
  )
}

// ── Sales history tab ─────────────────────────────────────────────────────────

function SalesHistoryTab({ locations, scopedLocationId }) {
  const [sales,     setSales]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [locFilter, setLocFilter] = useState('all')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')

  const fetchSales = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('retail_sales')
      .select('*, retail_items(name, category), students(student_first_name, student_last_name), locations(name)')
      .order('sold_at', { ascending: false })
      .limit(500)
    if (scopedLocationId) q = q.eq('location_id', scopedLocationId)
    else if (locFilter !== 'all') q = q.eq('location_id', locFilter)
    if (dateFrom) q = q.gte('sold_at', dateFrom + 'T00:00:00')
    if (dateTo)   q = q.lte('sold_at', dateTo   + 'T23:59:59')
    const { data } = await q
    setSales(data ?? [])
    setLoading(false)
  }, [scopedLocationId, locFilter, dateFrom, dateTo])

  useEffect(() => { fetchSales() }, [fetchSales])

  const filtered = sales.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    const item = s.retail_items?.name?.toLowerCase() ?? ''
    const name = `${s.students?.student_first_name ?? ''} ${s.students?.student_last_name ?? ''}`.toLowerCase()
    return item.includes(q) || name.includes(q)
  })

  const som = new Date(); som.setDate(1); som.setHours(0, 0, 0, 0)
  const monthSales   = sales.filter(s => new Date(s.sold_at) >= som)
  const monthRevenue = monthSales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0)

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Revenue This Month</p>
          <p className="text-2xl font-bold text-emerald-600 mt-0.5">{fmt$(monthRevenue)}</p>
          <p className="text-xs text-slate-400">{monthSales.length} sale{monthSales.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Sales Loaded</p>
          <p className="text-2xl font-bold text-indigo-600 mt-0.5">{sales.length}</p>
          <p className="text-xs text-slate-400">{fmt$(sales.reduce((s, r) => s + parseFloat(r.total || 0), 0))} lifetime</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <input type="search" placeholder="Search item or student…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        {!scopedLocationId && (
          <select value={locFilter} onChange={e => setLocFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="all">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <span className="text-slate-400 text-sm">→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12 italic">No sales found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                {['Date', 'Item', 'Student', 'Qty', 'Unit Price', 'Total', 'Payment', 'Location', 'Notes'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{fmtDate(s.sold_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{s.retail_items?.name ?? '—'}</p>
                    {s.retail_items?.category && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CAT_COLORS[s.retail_items.category]}`}>
                        {CAT_LABELS[s.retail_items.category]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {s.students ? `${s.students.student_first_name} ${s.students.student_last_name}` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{s.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{fmt$(s.unit_price)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">{fmt$(s.total)}</td>
                  <td className="px-4 py-3 text-xs">
                    {s.payment_method && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded capitalize font-medium">
                        {PAY_LABELS[s.payment_method] ?? s.payment_method}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.locations?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-32 truncate">{s.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RetailPage() {
  const { staff, canEdit, scopedLocationId } = useAuth()
  const [activeTab,  setActiveTab]  = useState('inventory')
  const [locations,  setLocations]  = useState([])
  const [addOpen,    setAddOpen]    = useState(false)

  useEffect(() => {
    supabase.from('locations').select('*').order('name').then(({ data }) => setLocations(data ?? []))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Retail</h2>
            <p className="text-xs text-slate-500">Inventory and sales management</p>
          </div>
          {canEdit && activeTab === 'inventory' && (
            <button onClick={() => setAddOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              + Add Item
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {[['inventory', 'Inventory'], ['sales', 'Sales History']].map(([k, l]) => (
            <button key={k} onClick={() => setActiveTab(k)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'inventory' ? (
          <InventoryTab
            locations={locations}
            scopedLocationId={scopedLocationId}
            staff={staff}
            canEdit={canEdit}
            externalAddOpen={addOpen}
            onExternalAddClose={() => setAddOpen(false)}
          />
        ) : (
          <SalesHistoryTab locations={locations} scopedLocationId={scopedLocationId} />
        )}
      </div>
    </div>
  )
}
