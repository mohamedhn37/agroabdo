import { useEffect, useState, useMemo } from 'react'
import SortableTable from '../components/SortableTable'
import { getAll, addItem, updateItem, deleteItem, getSoldeClient, COLS, MAD } from '../firebase'

const ZONES = [
  'Tanger-Tétouan-Al Hoceïma', "L'Oriental", 'Fès-Meknès',
  'Rabat-Salé-Kénitra', 'Béni Mellal-Khénifra', 'Casablanca-Settat',
  'Marrakech-Safi', 'Drâa-Tafilalet', 'Souss-Massa',
  'Guelmim-Oued Noun', 'Laâyoune-Sakia El Hamra', 'Dakhla-Oued Ed-Dahab',
]
const EMPTY = { nom:'', zone:'Casablanca-Settat', ville:'', tel:'', adresse:'', ice:'' }

export default function Clients({ showToast, search }) {
  const [clients, setClients]       = useState([])
  const [commandes, setCommandes]   = useState([])
  const [paiements, setPaiements]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [filterZone, setFilterZone] = useState('')
  const [modal, setModal]           = useState(false)
  const [form, setForm]             = useState(EMPTY)
  const [editId, setEditId]         = useState(null)
  const [saving, setSaving]         = useState(false)
  // ── Sélection multiple ───────────────────────────────────────────────────
  const [selected, setSelected]     = useState(new Set())
  const [deleting, setDeleting]     = useState(false)

  useEffect(() => {
    Promise.all([getAll(COLS.clients), getAll(COLS.commandes), getAll(COLS.paiements)])
      .then(([c,cmd,p]) => { setClients(c); setCommandes(cmd); setPaiements(p) })
      .catch(e => showToast(e.message,'error'))
      .finally(() => setLoading(false))
  }, [])

  const zones = [...new Set(clients.map(c=>c.zone))].sort()

  const enriched = useMemo(() => clients.map(c => {
    const { totalDu, totalPaye, solde } = getSoldeClient(c.id, commandes, paiements)
    return { ...c, totalDu, totalPaye, solde }
  }), [clients, commandes, paiements])

  const filtered = useMemo(() => enriched.filter(c =>
    (!search || c.nom.toLowerCase().includes(search.toLowerCase()) || (c.ice||'').includes(search) || (c.ville||'').toLowerCase().includes(search.toLowerCase())) &&
    (!filterZone || c.zone === filterZone)
  ), [enriched, search, filterZone])

  const totalDuAll   = enriched.reduce((s,c) => s + c.solde, 0)
  const totalPayeAll = enriched.reduce((s,c) => s + c.totalPaye, 0)

  // ── Select all / none ────────────────────────────────────────────────────
  const allFilteredIds = filtered.map(c => c.id)
  const allSelected    = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id))

  function toggleAll() {
    if (allSelected) {
      setSelected(s => { const n = new Set(s); allFilteredIds.forEach(id => n.delete(id)); return n })
    } else {
      setSelected(s => { const n = new Set(s); allFilteredIds.forEach(id => n.add(id)); return n })
    }
  }

  function toggleOne(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ── Suppression groupée ──────────────────────────────────────────────────
  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`Supprimer ${selected.size} client(s) sélectionné(s) ?\nAttention : leurs commandes ne seront pas supprimées.`)) return
    setDeleting(true)
    try {
      await Promise.all([...selected].map(id => deleteItem(COLS.clients, id)))
      setClients(cs => cs.filter(c => !selected.has(c.id)))
      setSelected(new Set())
      showToast(`${selected.size} client(s) supprimé(s) ✓`)
    } catch(e) { showToast(e.message,'error') }
    finally { setDeleting(false) }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  function openAdd() { setForm(EMPTY); setEditId(null); setModal(true) }
  function openEdit(c) {
    setForm({ nom:c.nom, zone:c.zone, ville:c.ville||'', tel:c.tel||'', adresse:c.adresse||'', ice:c.ice||'' })
    setEditId(c.id); setModal(true)
  }

  async function handleSave() {
    if (!form.nom.trim()) return showToast('Le nom est obligatoire','error')
    setSaving(true)
    try {
      if (editId) {
        await updateItem(COLS.clients,editId,form)
        setClients(cs=>cs.map(c=>c.id===editId?{id:editId,...form}:c))
        showToast('Client mis à jour ✓')
      } else {
        const id = await addItem(COLS.clients,form)
        setClients(cs=>[...cs,{id,...form}])
        showToast('Client ajouté ✓')
      }
      setModal(false)
    } catch(e) { showToast(e.message,'error') }
    finally { setSaving(false) }
  }

  async function handleDeleteOne(id, nom) {
    if (!confirm(`Supprimer "${nom}" ?`)) return
    await deleteItem(COLS.clients,id)
    setClients(cs=>cs.filter(c=>c.id!==id))
    setSelected(s => { const n = new Set(s); n.delete(id); return n })
    showToast('Client supprimé')
  }

  const columns = [
    // Checkbox
    {
      key: '__check',
      label: (
        <input type="checkbox" checked={allSelected} onChange={toggleAll}
          style={{ accentColor:'var(--primary)', width:15, height:15, cursor:'pointer' }} />
      ),
      sortable: false,
      render: r => (
        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)}
          style={{ accentColor:'var(--primary)', width:15, height:15, cursor:'pointer' }} />
      )
    },
    { key:'nom',     label:'Nom',   render: r => <strong>{r.nom}</strong> },
    { key:'zone',    label:'Zone',  render: r => <span className="badge-zone">{r.zone}</span> },
    { key:'ville',   label:'Ville', render: r => r.ville||'—' },
    { key:'tel',     label:'Tél',   render: r => r.tel||'—' },
    { key:'ice',     label:'ICE',   render: r => <span style={{ fontSize:11.5, color:'var(--text-soft)' }}>{r.ice||'—'}</span> },
    { key:'totalDu', label:'Total Dû', render: r => <span className="amount-warn">{MAD(r.totalDu)}</span> },
    { key:'solde',   label:'Solde', render: r => <span className={r.solde>0?'amount-neg':'amount-pos'}>{MAD(r.solde)}</span> },
    { key:'actions', label:'', sortable:false, render: r => (
      <div className="d-flex gap-1">
        <button className="btn-icon" onClick={()=>openEdit(r)}><i className="bi bi-pencil"></i></button>
        <button className="btn-icon btn-danger" onClick={()=>handleDeleteOne(r.id,r.nom)}><i className="bi bi-trash"></i></button>
      </div>
    )},
  ]

  if (loading) return <div className="loading-box"><div className="spinner-agro"></div><p>Chargement clients...</p></div>

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-3">
        {[
          { label:'Total Clients',   val:clients.length,                                 cls:'' },
          { label:'Zones Couvertes', val:new Set(clients.map(c=>c.zone)).size,           cls:'' },
          { label:'Crédit En Cours', val:MAD(totalDuAll),                                cls:'amount-neg' },
          { label:'Total Recouvré',  val:MAD(totalPayeAll),                              cls:'amount-pos' },
        ].map(s => (
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="stat-box"><span className={`stat-val ${s.cls}`}>{s.val}</span><span className="stat-label">{s.label}</span></div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="page-header-agro">
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <select className="form-control-agro" style={{ width:'auto' }} value={filterZone} onChange={e=>setFilterZone(e.target.value)}>
            <option value="">Toutes les zones</option>
            {zones.map(z=><option key={z}>{z}</option>)}
          </select>
          {search && <span style={{ fontSize:12, color:'var(--text-soft)', alignSelf:'center' }}>Filtre: "{search}"</span>}
        </div>
        <div className="d-flex gap-2">
          {selected.size > 0 && (
            <button className="btn-outline-agro d-flex align-items-center gap-2"
              style={{ borderColor:'var(--accent-danger)', color:'var(--accent-danger)' }}
              onClick={deleteSelected} disabled={deleting}>
              {deleting
                ? <><span className="spinner-border spinner-border-sm"></span> Suppression...</>
                : <><i className="bi bi-trash3-fill"></i> Supprimer ({selected.size})</>
              }
            </button>
          )}
          <button className="btn-primary-agro" onClick={openAdd}>
            <i className="bi bi-plus-lg"></i> Nouveau Client
          </button>
        </div>
      </div>

      <div className="card-agro">
        <SortableTable columns={columns} data={filtered} emptyMsg="Aucun client trouvé" />
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay-agro" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal-agro">
            <div className="modal-title-agro">
              <i className="bi bi-person-fill" style={{ color:'var(--primary)' }}></i>
              {editId?'Modifier Client':'Nouveau Client'}
            </div>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label-agro">Nom / Entreprise *</label>
                <input className="form-control-agro" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Ferme du Souss" />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Zone *</label>
                <select className="form-control-agro" value={form.zone} onChange={e=>setForm(f=>({...f,zone:e.target.value}))}>
                  {ZONES.map(z=><option key={z}>{z}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label-agro">Ville</label>
                <input className="form-control-agro" value={form.ville} onChange={e=>setForm(f=>({...f,ville:e.target.value}))} placeholder="Casablanca" />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Téléphone</label>
                <input className="form-control-agro" value={form.tel} onChange={e=>setForm(f=>({...f,tel:e.target.value}))} placeholder="0661234567" />
              </div>
              <div className="col-6">
                <label className="form-label-agro">ICE</label>
                <input className="form-control-agro" value={form.ice} onChange={e=>setForm(f=>({...f,ice:e.target.value}))} placeholder="001234567000001" maxLength={15} />
              </div>
              <div className="col-12">
                <label className="form-label-agro">Adresse</label>
                <input className="form-control-agro" value={form.adresse} onChange={e=>setForm(f=>({...f,adresse:e.target.value}))} placeholder="Km 12 Route Taroudant" />
              </div>
            </div>
            <div className="modal-footer-agro">
              <button className="btn-outline-agro" onClick={()=>setModal(false)}>Annuler</button>
              <button className="btn-primary-agro" onClick={handleSave} disabled={saving}>
                {saving?<><span className="spinner-border spinner-border-sm me-2"></span>Enregistrement...</>:'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}