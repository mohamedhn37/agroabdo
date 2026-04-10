import { useEffect, useState, useMemo } from 'react'
import SortableTable from '../components/SortableTable'
import { getAll, addItem, updateItem, deleteItem, COLS, MAD } from '../firebase'
import { CATS, CAT_CONFIG, getCatConfig } from '../config/categories'

const EMPTY = { nom:'', categorie:'Insecticide', unite:'', prixBase:'', fournisseur:'', stock:'', stockMin:'' }

export default function Produits({ showToast, search }) {
  const [produits, setProduits]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [filterCat, setFilterCat]   = useState('')
  const [modal, setModal]           = useState(false)
  const [form, setForm]             = useState(EMPTY)
  const [editId, setEditId]         = useState(null)
  const [saving, setSaving]         = useState(false)
  // ── Sélection multiple ───────────────────────────────────────────────────
  const [selected, setSelected]     = useState(new Set())
  const [deleting, setDeleting]     = useState(false)

  useEffect(() => {
    getAll(COLS.produits).then(setProduits).catch(e=>showToast(e.message,'error')).finally(()=>setLoading(false))
  }, [])

  const filtered = useMemo(() => produits.filter(p =>
    (!search || p.nom.toLowerCase().includes(search.toLowerCase()) || (p.fournisseur||'').toLowerCase().includes(search.toLowerCase())) &&
    (!filterCat || p.categorie === filterCat)
  ), [produits, search, filterCat])

  const alertes     = produits.filter(p => p.stock <= p.stockMin)
  const valeurStock = produits.reduce((s,p) => s + p.stock * p.prixBase, 0)

  // ── Select all / none ────────────────────────────────────────────────────
  const allFilteredIds = filtered.map(p => p.id)
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
    if (!confirm(`Supprimer ${selected.size} produit(s) sélectionné(s) ?`)) return
    setDeleting(true)
    try {
      await Promise.all([...selected].map(id => deleteItem(COLS.produits, id)))
      setProduits(ps => ps.filter(p => !selected.has(p.id)))
      setSelected(new Set())
      showToast(`${selected.size} produit(s) supprimé(s) ✓`)
    } catch(e) { showToast(e.message, 'error') }
    finally { setDeleting(false) }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  function openAdd() { setForm(EMPTY); setEditId(null); setModal(true) }
  function openEdit(p) {
    setForm({ nom:p.nom, categorie:p.categorie, unite:p.unite||'', prixBase:p.prixBase, fournisseur:p.fournisseur||'', stock:p.stock, stockMin:p.stockMin })
    setEditId(p.id); setModal(true)
  }

  async function handleSave() {
    if (!form.nom.trim()||!form.prixBase) return showToast('Nom et prix obligatoires','error')
    setSaving(true)
    const data = {...form, prixBase:parseFloat(form.prixBase), stock:parseInt(form.stock)||0, stockMin:parseInt(form.stockMin)||5}
    try {
      if (editId) {
        await updateItem(COLS.produits,editId,data)
        setProduits(ps=>ps.map(p=>p.id===editId?{id:editId,...data}:p))
        showToast('Produit mis à jour ✓')
      } else {
        const id = await addItem(COLS.produits,data)
        setProduits(ps=>[...ps,{id,...data}])
        showToast('Produit ajouté ✓')
      }
      setModal(false)
    } catch(e) { showToast(e.message,'error') }
    finally { setSaving(false) }
  }

  async function handleDeleteOne(id, nom) {
    if (!confirm(`Supprimer "${nom}" ?`)) return
    await deleteItem(COLS.produits,id)
    setProduits(ps=>ps.filter(p=>p.id!==id))
    setSelected(s => { const n = new Set(s); n.delete(id); return n })
    showToast('Produit supprimé')
  }

  const columns = [
    // Checkbox colonne
    {
      key: '__check', label: (
        <input type="checkbox" checked={allSelected} onChange={toggleAll}
          style={{ accentColor:'var(--primary)', width:15, height:15, cursor:'pointer' }} />
      ),
      sortable: false,
      render: r => (
        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)}
          style={{ accentColor:'var(--primary)', width:15, height:15, cursor:'pointer' }} />
      )
    },
    { key:'nom',      label:'Produit',   render: r => (
      <><strong>{r.nom}</strong><div style={{ fontSize:11, color:'var(--text-soft)' }}>{r.fournisseur}</div></>
    )},
    { key:'categorie', label:'Catégorie', render: r => {
      const cfg = getCatConfig(r.categorie)
      return (
        <span style={{ background:cfg.bg, color:cfg.color, fontSize:11.5, fontWeight:600, padding:'3px 9px', borderRadius:5, display:'inline-flex', alignItems:'center', gap:5 }}>
          <i className={`bi ${cfg.icon}`} style={{ fontSize:11 }}></i>
          {r.categorie}
        </span>
      )
    }},
    { key:'unite',    label:'Unité',     render: r => <span style={{ color:'var(--text-soft)' }}>{r.unite}</span> },
    { key:'prixBase', label:'Prix Base', render: r => <span className="amount-pos">{(r.prixBase||0).toLocaleString('fr-MA')} MAD</span> },
    { key:'stock',    label:'Stock',     render: r => {
      const alerte = r.stock <= r.stockMin
      const pct    = Math.min(100, Math.round(r.stock / Math.max(r.stockMin*3,1)*100))
      const cfg    = getCatConfig(r.categorie)
      return (
        <>
          <strong style={{ color: alerte?'var(--accent-danger)':'var(--text-main)' }}>{r.stock}</strong>
          <div style={{ width:70, height:4, background:'var(--border)', borderRadius:2, marginTop:4 }}>
            <div style={{ width:`${pct}%`, height:'100%', background: alerte?'var(--accent-danger)':cfg.color, borderRadius:2 }}></div>
          </div>
        </>
      )
    }},
    { key:'stockMin', label:'Min',       render: r => <span style={{ color:'var(--text-soft)' }}>{r.stockMin}</span> },
    { key:'statut',   label:'Statut', sortable:false, render: r =>
      r.stock<=r.stockMin ? <span className="badge-retard">⚠ Stock Bas</span> : <span className="badge-ok">✓ OK</span>
    },
    { key:'actions',  label:'', sortable:false, render: r => (
      <div className="d-flex gap-1">
        <button className="btn-icon" onClick={()=>openEdit(r)}><i className="bi bi-pencil"></i></button>
        <button className="btn-icon btn-danger" onClick={()=>handleDeleteOne(r.id,r.nom)}><i className="bi bi-trash"></i></button>
      </div>
    )},
  ]

  if (loading) return <div className="loading-box"><div className="spinner-agro"></div><p>Chargement produits...</p></div>

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-3">
        {[
          { label:'Produits',     val:produits.length,  cls:'' },
          { label:'Alertes Stock',val:alertes.length,   cls:alertes.length>0?'amount-neg':'amount-pos' },
          { label:'Catégories',   val:new Set(produits.map(p=>p.categorie)).size, cls:'' },
          { label:'Valeur Stock', val:MAD(valeurStock), cls:'amount-pos' },
        ].map(s => (
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="stat-box"><span className={`stat-val ${s.cls}`}>{s.val}</span><span className="stat-label">{s.label}</span></div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="page-header-agro">
        <div className="d-flex gap-2 flex-wrap align-items-center">
          {/* Filtre catégorie */}
          <select className="form-control-agro" style={{ width:'auto' }} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="">Toutes catégories</option>
            {CATS.map(c => {
              const cfg = getCatConfig(c)
              return <option key={c} value={c}>{c}</option>
            })}
          </select>

          {/* Légende couleurs catégories */}
          <div className="d-flex gap-2 flex-wrap">
            {CATS.map(c => {
              const cfg = getCatConfig(c)
              return (
                <span key={c} style={{ background:cfg.bg, color:cfg.color, fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:4, display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer', border: filterCat===c?`1.5px solid ${cfg.color}`:'1.5px solid transparent' }}
                  onClick={() => setFilterCat(f => f===c ? '' : c)}>
                  <i className={`bi ${cfg.icon}`} style={{ fontSize:10 }}></i>
                  {c}
                </span>
              )
            })}
          </div>

          {search && <span style={{ fontSize:12, color:'var(--text-soft)', alignSelf:'center' }}>Filtre: "{search}"</span>}
        </div>

        <div className="d-flex gap-2">
          {/* Bouton suppression groupée */}
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
            <i className="bi bi-plus-lg"></i> Nouveau Produit
          </button>
        </div>
      </div>

      <div className="card-agro">
        <SortableTable columns={columns} data={filtered} emptyMsg="Aucun produit trouvé" />
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay-agro" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal-agro">
            <div className="modal-title-agro">
              <i className={`bi ${getCatConfig(form.categorie).icon}`} style={{ color:getCatConfig(form.categorie).color }}></i>
              {editId?'Modifier Produit':'Nouveau Produit'}
            </div>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label-agro">Nom du Produit *</label>
                <input className="form-control-agro" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Ex: Lambda Cyhalothrine 5% EC" />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Catégorie *</label>
                <select className="form-control-agro" value={form.categorie} onChange={e=>setForm(f=>({...f,categorie:e.target.value}))}>
                  {CATS.map(c => {
                    const cfg = getCatConfig(c)
                    return <option key={c} value={c}>{c} — {cfg.groupe}</option>
                  })}
                </select>
                {/* Preview couleur catégorie sélectionnée */}
                <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ background:getCatConfig(form.categorie).bg, color:getCatConfig(form.categorie).color, fontSize:11.5, fontWeight:600, padding:'3px 10px', borderRadius:5, display:'inline-flex', alignItems:'center', gap:5 }}>
                    <i className={`bi ${getCatConfig(form.categorie).icon}`} style={{ fontSize:11 }}></i>
                    {form.categorie}
                  </span>
                </div>
              </div>
              <div className="col-6">
                <label className="form-label-agro">Unité</label>
                <input className="form-control-agro" value={form.unite} onChange={e=>setForm(f=>({...f,unite:e.target.value}))} placeholder="L, Kg, Sac 25kg..." />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Prix de Base (MAD) *</label>
                <input className="form-control-agro" type="number" min="0" value={form.prixBase} onChange={e=>setForm(f=>({...f,prixBase:e.target.value}))} placeholder="320" />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Fournisseur</label>
                <input className="form-control-agro" value={form.fournisseur} onChange={e=>setForm(f=>({...f,fournisseur:e.target.value}))} placeholder="AgriChim SA" />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Stock Initial</label>
                <input className="form-control-agro" type="number" min="0" value={form.stock} onChange={e=>setForm(f=>({...f,stock:e.target.value}))} placeholder="50" />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Stock Minimum (Alerte)</label>
                <input className="form-control-agro" type="number" min="0" value={form.stockMin} onChange={e=>setForm(f=>({...f,stockMin:e.target.value}))} placeholder="10" />
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