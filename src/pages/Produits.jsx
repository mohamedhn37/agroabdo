import { useEffect, useState, useMemo } from 'react'
import SortableTable from '../components/SortableTable'
import { getAll, addItem, updateItem, deleteItem, COLS, MAD } from '../firebase'

const CATS = ['Engrais','Semences','Phytosanitaires','Machinerie']
const CAT_COLORS = { Engrais:'#7B0D1E', Semences:'#3D9970', Phytosanitaires:'#E8C547', Machinerie:'#6B7280' }
const EMPTY = { nom:'', categorie:'Engrais', unite:'', prixBase:'', fournisseur:'', stock:'', stockMin:'' }

export default function Produits({ showToast, search }) {
  const [produits, setProduits] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    getAll(COLS.produits).then(setProduits).catch(e=>showToast(e.message,'error')).finally(()=>setLoading(false))
  }, [])

  const filtered = useMemo(() => produits.filter(p =>
    (!search || p.nom.toLowerCase().includes(search.toLowerCase()) || (p.fournisseur||'').toLowerCase().includes(search.toLowerCase())) &&
    (!filterCat || p.categorie === filterCat)
  ), [produits, search, filterCat])

  const alertes    = produits.filter(p => p.stock <= p.stockMin)
  const valeurStock = produits.reduce((s,p) => s + p.stock * p.prixBase, 0)

  function openAdd() { setForm(EMPTY); setEditId(null); setModal(true) }
  function openEdit(p) { setForm({nom:p.nom,categorie:p.categorie,unite:p.unite||'',prixBase:p.prixBase,fournisseur:p.fournisseur||'',stock:p.stock,stockMin:p.stockMin}); setEditId(p.id); setModal(true) }

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

  async function handleDelete(id, nom) {
    if (!confirm(`Supprimer "${nom}" ?`)) return
    await deleteItem(COLS.produits,id)
    setProduits(ps=>ps.filter(p=>p.id!==id))
    showToast('Produit supprimé')
  }

  const columns = [
    { key:'nom',       label:'Produit',    render: r => <><strong>{r.nom}</strong><div style={{fontSize:11,color:'var(--text-soft)'}}>{r.fournisseur}</div></> },
    { key:'categorie', label:'Catégorie',  render: r => { const col=CAT_COLORS[r.categorie]||'#6B7280'; return <span style={{background:`${col}18`,color:col,fontSize:11.5,fontWeight:600,padding:'2px 9px',borderRadius:5}}>{r.categorie}</span> } },
    { key:'unite',     label:'Unité',      render: r => <span style={{color:'var(--text-soft)'}}>{r.unite}</span> },
    { key:'prixBase',  label:'Prix Base',  render: r => <span className="amount-pos">{(r.prixBase||0).toLocaleString('fr-MA')} MAD</span> },
    { key:'stock',     label:'Stock',      render: r => {
      const alerte = r.stock<=r.stockMin
      const pct = Math.min(100,Math.round(r.stock/Math.max(r.stockMin*3,1)*100))
      return <>
        <strong style={{color:alerte?'var(--accent-danger)':'var(--text-main)'}}>{r.stock}</strong>
        <div style={{width:70,height:4,background:'var(--border)',borderRadius:2,marginTop:4}}>
          <div style={{width:`${pct}%`,height:'100%',background:alerte?'var(--accent-danger)':'var(--primary)',borderRadius:2}}></div>
        </div>
      </>
    }},
    { key:'stockMin',  label:'Min',        render: r => <span style={{color:'var(--text-soft)'}}>{r.stockMin}</span> },
    { key:'statut',    label:'Statut', sortable:false, render: r => r.stock<=r.stockMin ? <span className="badge-retard">⚠ Stock Bas</span> : <span className="badge-ok">✓ OK</span> },
    { key:'actions',   label:'', sortable:false, render: r => (
      <div className="d-flex gap-1">
        <button className="btn-icon" onClick={()=>openEdit(r)}><i className="bi bi-pencil"></i></button>
        <button className="btn-icon btn-danger" onClick={()=>handleDelete(r.id,r.nom)}><i className="bi bi-trash"></i></button>
      </div>
    )},
  ]

  if (loading) return <div className="loading-box"><div className="spinner-agro"></div><p>Chargement produits...</p></div>

  return (
    <div>
      <div className="row g-3 mb-3">
        {[
          {label:'Produits',     val:produits.length, cls:''},
          {label:'Alertes Stock',val:alertes.length,  cls:alertes.length>0?'amount-neg':'amount-pos'},
          {label:'Catégories',   val:new Set(produits.map(p=>p.categorie)).size, cls:''},
          {label:'Valeur Stock', val:MAD(valeurStock), cls:'amount-pos'},
        ].map(s=>(
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="stat-box"><span className={`stat-val ${s.cls}`}>{s.val}</span><span className="stat-label">{s.label}</span></div>
          </div>
        ))}
      </div>

      <div className="page-header-agro">
        <div className="d-flex gap-2 flex-wrap">
          <select className="form-control-agro" style={{width:'auto'}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="">Toutes catégories</option>
            {CATS.map(c=><option key={c}>{c}</option>)}
          </select>
          {search && <span style={{fontSize:12,color:'var(--text-soft)',alignSelf:'center'}}>Filtre: "{search}"</span>}
        </div>
        <button className="btn-primary-agro" onClick={openAdd}><i className="bi bi-plus-lg"></i> Nouveau Produit</button>
      </div>

      <div className="card-agro">
        <SortableTable columns={columns} data={filtered} emptyMsg="Aucun produit trouvé" />
      </div>

      {modal && (
        <div className="modal-overlay-agro" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal-agro">
            <div className="modal-title-agro"><i className="bi bi-box-seam-fill" style={{color:'var(--primary)'}}></i>{editId?'Modifier Produit':'Nouveau Produit'}</div>
            <div className="row g-3">
              <div className="col-12"><label className="form-label-agro">Nom *</label><input className="form-control-agro" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Engrais NPK 20-20-20" /></div>
              <div className="col-6"><label className="form-label-agro">Catégorie *</label><select className="form-control-agro" value={form.categorie} onChange={e=>setForm(f=>({...f,categorie:e.target.value}))}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
              <div className="col-6"><label className="form-label-agro">Unité</label><input className="form-control-agro" value={form.unite} onChange={e=>setForm(f=>({...f,unite:e.target.value}))} placeholder="Sac 50kg" /></div>
              <div className="col-6"><label className="form-label-agro">Prix Base (MAD) *</label><input className="form-control-agro" type="number" min="0" value={form.prixBase} onChange={e=>setForm(f=>({...f,prixBase:e.target.value}))} placeholder="320" /></div>
              <div className="col-6"><label className="form-label-agro">Fournisseur</label><input className="form-control-agro" value={form.fournisseur} onChange={e=>setForm(f=>({...f,fournisseur:e.target.value}))} placeholder="AgriChim SA" /></div>
              <div className="col-6"><label className="form-label-agro">Stock Initial</label><input className="form-control-agro" type="number" min="0" value={form.stock} onChange={e=>setForm(f=>({...f,stock:e.target.value}))} placeholder="50" /></div>
              <div className="col-6"><label className="form-label-agro">Stock Minimum</label><input className="form-control-agro" type="number" min="0" value={form.stockMin} onChange={e=>setForm(f=>({...f,stockMin:e.target.value}))} placeholder="10" /></div>
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