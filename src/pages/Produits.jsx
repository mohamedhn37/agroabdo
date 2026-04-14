import { useEffect, useState, useMemo } from 'react'
import SortableTable from '../components/SortableTable'
import { getAll, addItemWithNumero, updateItem, deleteItem, setItem, COLS, MAD } from '../firebase'
import { CAT_CONFIG } from '../config/categories'

// ── Couleurs disponibles pour les nouvelles catégories ────────────────────────
const COLOR_PRESETS = [
  { color: '#E74C3C', bg: 'rgba(231,76,60,0.12)',   label: 'Rouge'     },
  { color: '#E67E22', bg: 'rgba(230,126,34,0.12)',  label: 'Orange'    },
  { color: '#E8C547', bg: 'rgba(232,197,71,0.12)',  label: 'Jaune'     },
  { color: '#27AE60', bg: 'rgba(39,174,96,0.12)',   label: 'Vert'      },
  { color: '#2980B9', bg: 'rgba(41,128,185,0.12)',  label: 'Bleu'      },
  { color: '#8E44AD', bg: 'rgba(142,68,173,0.12)',  label: 'Violet'    },
  { color: '#7B0D1E', bg: 'rgba(123,13,30,0.12)',   label: 'Bordeaux'  },
  { color: '#16A085', bg: 'rgba(22,160,133,0.12)',  label: 'Turquoise' },
  { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', label: 'Gris'      },
]

// ── Icônes disponibles ────────────────────────────────────────────────────────
const ICON_OPTIONS = [
  { value: 'bi-bug-fill',       label: 'Insecte'    },
  { value: 'bi-capsule',        label: 'Fongicide'  },
  { value: 'bi-droplet-fill',   label: 'Liquide'    },
  { value: 'bi-flower1',        label: 'Plante'     },
  { value: 'bi-lightning-fill', label: 'Stimulant'  },
  { value: 'bi-tree-fill',      label: 'Arbre'      },
  { value: 'bi-box-seam',       label: 'Produit'    },
  { value: 'bi-tag',            label: 'Tag'        },
  { value: 'bi-star-fill',      label: 'Spécial'    },
  { value: 'bi-shield-fill',    label: 'Protection' },
  { value: 'bi-moisture',       label: 'Engrais'    },
  { value: 'bi-seedling',       label: 'Semences'   },
]

const EMPTY_PROD = { nom:'', categorie:'', unite:'', prixBase:'', fournisseur:'', stock:'', stockMin:'' }
const EMPTY_CAT  = { nom:'', groupe:'', color: COLOR_PRESETS[0].color, bg: COLOR_PRESETS[0].bg, icon: 'bi-tag' }

export default function Produits({ showToast, search }) {
  const [produits, setProduits]   = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(EMPTY_PROD)
  const [editId, setEditId]       = useState(null)
  const [saving, setSaving]       = useState(false)
  // ── Gestion catégories ───────────────────────────────────────────────────
  const [catModal, setCatModal]   = useState(false)
  const [catForm, setCatForm]     = useState(EMPTY_CAT)
  const [catSaving, setCatSaving] = useState(false)
  // ── Sélection multiple ───────────────────────────────────────────────────
  const [selected, setSelected]   = useState(new Set())
  const [deleting, setDeleting]   = useState(false)

  // ── Chargement ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [prods, cats] = await Promise.all([
          getAll(COLS.produits),
          getAll(COLS.categories),
        ])
        setProduits(prods)

        if (cats.length === 0) {
          // Première utilisation : initialiser avec les catégories par défaut
          const defaults = Object.entries(CAT_CONFIG).map(([nom, cfg]) => ({ nom, ...cfg }))
          await Promise.all(defaults.map(c => setItem(COLS.categories, c.nom, c)))
          setCategories(defaults.map((c, i) => ({ id: c.nom, ...c })))
        } else {
          setCategories(cats)
        }
      } catch(e) { showToast(e.message, 'error') }
      finally { setLoading(false) }
    }
    load()
  }, [showToast])

  // ── Helper : config d'une catégorie ──────────────────────────────────────
  function getCat(nom) {
    return categories.find(c => c.nom === nom)
      || { color:'#6B7280', bg:'rgba(107,114,128,0.12)', icon:'bi-box', groupe:'Autre', nom }
  }

  // ── Filtrage produits ─────────────────────────────────────────────────────
  const filtered = useMemo(() => produits.filter(p =>
    (!search || p.nom.toLowerCase().includes(search.toLowerCase()) || (p.fournisseur||'').toLowerCase().includes(search.toLowerCase())) &&
    (!filterCat || p.categorie === filterCat)
  ), [produits, search, filterCat])

  const alertes     = produits.filter(p => p.stock <= p.stockMin)
  const valeurStock = produits.reduce((s,p) => s + p.stock * p.prixBase, 0)

  // ── Sélection ────────────────────────────────────────────────────────────
  const allFilteredIds = filtered.map(p => p.id)
  const allSelected    = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id))
  function toggleAll() {
    if (allSelected) setSelected(s => { const n=new Set(s); allFilteredIds.forEach(id=>n.delete(id)); return n })
    else setSelected(s => { const n=new Set(s); allFilteredIds.forEach(id=>n.add(id)); return n })
  }
  function toggleOne(id) {
    setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  }

  async function deleteSelected() {
    if (!selected.size) return
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

  // ── CRUD Produits ─────────────────────────────────────────────────────────
  function openAdd() {
    const firstCat = categories[0]?.nom || ''
    setForm({ ...EMPTY_PROD, categorie: firstCat })
    setEditId(null); setModal(true)
  }
  function openEdit(p) {
    setForm({ nom:p.nom, categorie:p.categorie, unite:p.unite||'', prixBase:p.prixBase, fournisseur:p.fournisseur||'', stock:p.stock, stockMin:p.stockMin })
    setEditId(p.id); setModal(true)
  }

  async function handleSave() {
    if (!form.nom.trim() || !form.prixBase) return showToast('Nom et prix obligatoires', 'error')
    if (!form.categorie) return showToast('Choisir une catégorie', 'error')
    setSaving(true)
    const data = { ...form, prixBase:parseFloat(form.prixBase), stock:parseInt(form.stock)||0, stockMin:parseInt(form.stockMin)||5 }
    try {
      if (editId) {
        await updateItem(COLS.produits, editId, data)
        setProduits(ps => ps.map(p => p.id===editId ? { id:editId, ...data } : p))
        showToast('Produit mis à jour ✓')
      } else {
        const { id, numero } = await addItemWithNumero(COLS.produits, data)
        setProduits(ps => [...ps, { id, numero, ...data }])
        showToast('Produit ajouté ✓')
      }
      setModal(false)
    } catch(e) { showToast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleDeleteOne(id, nom) {
    if (!confirm(`Supprimer "${nom}" ?`)) return
    await deleteItem(COLS.produits, id)
    setProduits(ps => ps.filter(p => p.id !== id))
    setSelected(s => { const n=new Set(s); n.delete(id); return n })
    showToast('Produit supprimé')
  }

  // ── CRUD Catégories ───────────────────────────────────────────────────────
  async function handleAddCat() {
    if (!catForm.nom.trim()) return showToast('Nom de catégorie obligatoire', 'error')
    if (categories.find(c => c.nom.toLowerCase() === catForm.nom.trim().toLowerCase()))
      return showToast('Cette catégorie existe déjà', 'error')
    setCatSaving(true)
    try {
      const data = {
        nom:    catForm.nom.trim(),
        groupe: catForm.groupe.trim() || catForm.nom.trim(),
        color:  catForm.color,
        bg:     catForm.bg,
        icon:   catForm.icon,
      }
      await setItem(COLS.categories, data.nom, data)
      setCategories(cs => [...cs, { id: data.nom, ...data }])
      setCatForm(EMPTY_CAT)
      showToast(`Catégorie "${data.nom}" ajoutée ✓`)
    } catch(e) { showToast(e.message, 'error') }
    finally { setCatSaving(false) }
  }

  async function handleDeleteCat(cat) {
    const inUse = produits.some(p => p.categorie === cat.nom)
    if (inUse) return showToast(`Impossible : des produits utilisent "${cat.nom}"`, 'error')
    if (!confirm(`Supprimer la catégorie "${cat.nom}" ?`)) return
    await deleteItem(COLS.categories, cat.id)
    setCategories(cs => cs.filter(c => c.id !== cat.id))
    if (filterCat === cat.nom) setFilterCat('')
    showToast(`Catégorie "${cat.nom}" supprimée`)
  }

  // ── Colonnes tableau ──────────────────────────────────────────────────────
  const columns = [
    { key:'__check', sortable:false, label:(
        <input type="checkbox" checked={allSelected} onChange={toggleAll}
          style={{ accentColor:'var(--primary)', width:15, height:15, cursor:'pointer' }} />
      ),
      render: r => (
        <input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleOne(r.id)}
          style={{ accentColor:'var(--primary)', width:15, height:15, cursor:'pointer' }} />
      )
    },
    { key:'nom', label:'Produit', render: r => (
      <><strong>{r.nom}</strong><div style={{ fontSize:11, color:'var(--text-soft)' }}>{r.fournisseur}</div></>
    )},
    { key:'categorie', label:'Catégorie', render: r => {
      const cfg = getCat(r.categorie)
      return (
        <span style={{ background:cfg.bg, color:cfg.color, fontSize:11.5, fontWeight:600, padding:'3px 9px', borderRadius:5, display:'inline-flex', alignItems:'center', gap:5 }}>
          <i className={`bi ${cfg.icon}`} style={{ fontSize:11 }}></i>
          {r.categorie}
        </span>
      )
    }},
    { key:'unite',    label:'Unité',    render: r => <span style={{ color:'var(--text-soft)' }}>{r.unite}</span> },
    { key:'prixBase', label:'Prix Base', render: r => <span className="amount-pos">{(r.prixBase||0).toLocaleString('fr-MA')} MAD</span> },
    { key:'stock', label:'Stock', render: r => {
      const alerte = r.stock <= r.stockMin
      const pct    = Math.min(100, Math.round(r.stock / Math.max(r.stockMin*3,1)*100))
      const cfg    = getCat(r.categorie)
      return (
        <>
          <strong style={{ color: alerte?'var(--accent-danger)':'var(--text-main)' }}>{r.stock}</strong>
          <div style={{ width:70, height:4, background:'var(--border)', borderRadius:2, marginTop:4 }}>
            <div style={{ width:`${pct}%`, height:'100%', background:alerte?'var(--accent-danger)':cfg.color, borderRadius:2 }}></div>
          </div>
        </>
      )
    }},
    { key:'stockMin', label:'Min', render: r => <span style={{ color:'var(--text-soft)' }}>{r.stockMin}</span> },
    { key:'statut', label:'Statut', sortable:false, render: r =>
      r.stock<=r.stockMin ? <span className="badge-retard">⚠ Stock Bas</span> : <span className="badge-ok">✓ OK</span>
    },
    { key:'actions', label:'', sortable:false, render: r => (
      <div className="d-flex gap-1">
        <button className="btn-icon" onClick={()=>openEdit(r)}><i className="bi bi-pencil"></i></button>
        <button className="btn-icon btn-danger" onClick={()=>handleDeleteOne(r.id,r.nom)}><i className="bi bi-trash"></i></button>
      </div>
    )},
  ]

  if (loading) return <div className="loading-box"><div className="spinner-agro"></div><p>Chargement produits...</p></div>

  const selectedColor = COLOR_PRESETS.find(c => c.color === catForm.color) || COLOR_PRESETS[0]

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-3">
        {[
          { label:'Produits',      val:produits.length,  cls:'' },
          { label:'Alertes Stock', val:alertes.length,   cls:alertes.length>0?'amount-neg':'amount-pos' },
          { label:'Catégories',    val:categories.length, cls:'' },
          { label:'Valeur Stock',  val:MAD(valeurStock), cls:'amount-pos' },
        ].map(s => (
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="stat-box"><span className={`stat-val ${s.cls}`}>{s.val}</span><span className="stat-label">{s.label}</span></div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="page-header-agro">
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <select className="form-control-agro" style={{ width:'auto' }} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
          </select>

          <div className="d-flex gap-2 flex-wrap">
            {categories.map(c => (
              <span key={c.id}
                style={{ background:c.bg, color:c.color, fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:4,
                  display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer',
                  border: filterCat===c.nom?`1.5px solid ${c.color}`:'1.5px solid transparent' }}
                onClick={() => setFilterCat(f => f===c.nom ? '' : c.nom)}>
                <i className={`bi ${c.icon}`} style={{ fontSize:10 }}></i>
                {c.nom}
              </span>
            ))}
          </div>

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
          <button className="btn-outline-agro" onClick={()=>{ setCatForm(EMPTY_CAT); setCatModal(true) }}>
            <i className="bi bi-tags-fill"></i> Catégories
          </button>
          <button className="btn-primary-agro" onClick={openAdd}>
            <i className="bi bi-plus-lg"></i> Nouveau Produit
          </button>
        </div>
      </div>

      <div className="card-agro">
        <SortableTable columns={columns} data={filtered} emptyMsg="Aucun produit trouvé" />
      </div>

      {/* ── Modal Produit ──────────────────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay-agro" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal-agro">
            <div className="modal-title-agro">
              <i className={`bi ${getCat(form.categorie).icon}`} style={{ color:getCat(form.categorie).color }}></i>
              {editId ? 'Modifier Produit' : 'Nouveau Produit'}
            </div>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label-agro">Nom du Produit *</label>
                <input className="form-control-agro" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Ex: Lambda Cyhalothrine 5% EC" />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Catégorie *</label>
                <select className="form-control-agro" value={form.categorie} onChange={e=>setForm(f=>({...f,categorie:e.target.value}))}>
                  {categories.map(c => <option key={c.id} value={c.nom}>{c.nom} — {c.groupe}</option>)}
                </select>
                {form.categorie && (
                  <div style={{ marginTop:6, display:'inline-flex', alignItems:'center', gap:6,
                    background:getCat(form.categorie).bg, color:getCat(form.categorie).color,
                    fontSize:11.5, fontWeight:600, padding:'3px 10px', borderRadius:5 }}>
                    <i className={`bi ${getCat(form.categorie).icon}`} style={{ fontSize:11 }}></i>
                    {form.categorie}
                  </div>
                )}
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
                {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Enregistrement...</> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Gestion Catégories ───────────────────────────────────────── */}
      {catModal && (
        <div className="modal-overlay-agro" onClick={e=>e.target===e.currentTarget&&setCatModal(false)}>
          <div className="modal-agro" style={{ maxWidth:520 }}>
            <div className="modal-title-agro">
              <i className="bi bi-tags-fill" style={{ color:'var(--primary)' }}></i>
              Gestion des Catégories
            </div>

            {/* Liste des catégories existantes */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, color:'var(--text-soft)', fontWeight:600, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
                Catégories existantes ({categories.length})
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:220, overflowY:'auto' }}>
                {categories.map(c => {
                  const inUse = produits.filter(p => p.categorie === c.nom).length
                  return (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      background:'var(--bg)', borderRadius:8, padding:'8px 12px', border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ width:28, height:28, borderRadius:6, background:c.bg, display:'grid', placeItems:'center' }}>
                          <i className={`bi ${c.icon}`} style={{ color:c.color, fontSize:13 }}></i>
                        </span>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13, color:'var(--text-main)' }}>{c.nom}</div>
                          <div style={{ fontSize:11, color:'var(--text-soft)' }}>{c.groupe} — {inUse} produit{inUse>1?'s':''}</div>
                        </div>
                      </div>
                      <button className="btn-icon btn-danger" title="Supprimer"
                        onClick={()=>handleDeleteCat(c)}
                        disabled={inUse > 0}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Formulaire nouvelle catégorie */}
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'14px 16px', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:12, color:'var(--text-soft)', fontWeight:600, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>
                Ajouter une nouvelle catégorie
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label-agro">Nom *</label>
                  <input className="form-control-agro" value={catForm.nom}
                    onChange={e=>setCatForm(f=>({...f,nom:e.target.value}))}
                    placeholder="Ex: Herbicide" />
                </div>
                <div className="col-6">
                  <label className="form-label-agro">Groupe</label>
                  <input className="form-control-agro" value={catForm.groupe}
                    onChange={e=>setCatForm(f=>({...f,groupe:e.target.value}))}
                    placeholder="Ex: Phytosanitaire" />
                </div>

                {/* Choix couleur */}
                <div className="col-12">
                  <label className="form-label-agro">Couleur</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {COLOR_PRESETS.map(p => (
                      <button key={p.color} type="button"
                        title={p.label}
                        onClick={()=>setCatForm(f=>({...f, color:p.color, bg:p.bg}))}
                        style={{ width:28, height:28, borderRadius:6, background:p.color, border: catForm.color===p.color?'3px solid var(--text-main)':'3px solid transparent', cursor:'pointer', transition:'border 0.1s' }}>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Choix icône */}
                <div className="col-12">
                  <label className="form-label-agro">Icône</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {ICON_OPTIONS.map(ic => (
                      <button key={ic.value} type="button"
                        title={ic.label}
                        onClick={()=>setCatForm(f=>({...f, icon:ic.value}))}
                        style={{ width:34, height:34, borderRadius:6, border: catForm.icon===ic.value?`2px solid ${catForm.color}`:'2px solid var(--border)',
                          background: catForm.icon===ic.value?selectedColor.bg:'var(--bg-card)', cursor:'pointer', transition:'all 0.15s' }}>
                        <i className={`bi ${ic.value}`} style={{ color: catForm.icon===ic.value?catForm.color:'var(--text-soft)', fontSize:14 }}></i>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aperçu */}
                {catForm.nom && (
                  <div className="col-12">
                    <label className="form-label-agro">Aperçu</label>
                    <span style={{ background:catForm.bg, color:catForm.color, fontSize:12, fontWeight:600,
                      padding:'4px 12px', borderRadius:6, display:'inline-flex', alignItems:'center', gap:6 }}>
                      <i className={`bi ${catForm.icon}`} style={{ fontSize:12 }}></i>
                      {catForm.nom}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginTop:12 }}>
                <button className="btn-primary-agro" onClick={handleAddCat} disabled={catSaving || !catForm.nom.trim()}>
                  {catSaving ? <><span className="spinner-border spinner-border-sm me-2"></span>Ajout...</> : <><i className="bi bi-plus-lg"></i> Ajouter la catégorie</>}
                </button>
              </div>
            </div>

            <div className="modal-footer-agro">
              <button className="btn-outline-agro" onClick={()=>setCatModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
