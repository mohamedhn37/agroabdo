import { useEffect, useState, useMemo } from 'react'
import SortableTable from '../components/SortableTable'
import { getAll, addItem, updateItem, deleteItem, getTotal, COLS, MAD, fmtDate } from '../firebase'

const EMPTY_LIGNE = { produitId:'', qte:'', prixUnit:'' }

export default function Commandes({ showToast, search }) {
  const [commandes, setCommandes] = useState([])
  const [clients, setClients]     = useState([])
  const [produits, setProduits]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterStatut, setFilterStatut] = useState('')
  const [modal, setModal]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [clientId, setClientId]   = useState('')
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [lignes, setLignes]       = useState([{...EMPTY_LIGNE}])

  useEffect(() => {
    Promise.all([getAll(COLS.commandes),getAll(COLS.clients),getAll(COLS.produits),getAll(COLS.paiements)])
      .then(([cmd,cl,pr]) => { setCommandes(cmd); setClients(cl); setProduits(pr) })
      .catch(e=>showToast(e.message,'error'))
      .finally(()=>setLoading(false))
  }, [])

  // Données enrichies
  const enriched = useMemo(() => commandes.map(c => {
    const cl = clients.find(x=>x.id===c.clientId)
    const total = getTotal(c)
    return { ...c, clientNom: cl?cl.nom:'?', zone: cl?cl.zone:'—', total, restant: total-(c.paiementRecu||0) }
  }), [commandes, clients])

  const filtered = useMemo(() => enriched.filter(c =>
    (!search || c.clientNom.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatut || c.statut === filterStatut)
  ).sort((a,b)=>new Date(b.date)-new Date(a.date)), [enriched, search, filterStatut])

  const totalCA = commandes.reduce((s,c)=>s+getTotal(c),0)

  function addLigne() { setLignes(l=>[...l,{...EMPTY_LIGNE}]) }
  function removeLigne(i) { setLignes(l=>l.filter((_,idx)=>idx!==i)) }
  function updateLigne(i,field,val) {
    setLignes(l=>l.map((ln,idx)=>{
      if(idx!==i)return ln
      const updated={...ln,[field]:val}
      if(field==='produitId'){const prod=produits.find(p=>p.id===val);if(prod)updated.prixUnit=prod.prixBase}
      return updated
    }))
  }
  const totalCmd = lignes.reduce((s,l)=>s+(parseFloat(l.qte)||0)*(parseFloat(l.prixUnit)||0),0)

  function openModal(){setClientId('');setDate(new Date().toISOString().split('T')[0]);setLignes([{...EMPTY_LIGNE}]);setModal(true)}

  async function handleSave(){
    if(!clientId||!date)return showToast('Client et date obligatoires','error')
    const validLignes=lignes.filter(l=>l.produitId&&parseFloat(l.qte)>0)
    if(!validLignes.length)return showToast('Ajouter au moins un produit valide','error')
    setSaving(true)
    try{
      for(const l of validLignes){
        const prod=produits.find(p=>p.id===l.produitId)
        if(prod){const newStock=Math.max(0,prod.stock-parseFloat(l.qte));await updateItem(COLS.produits,prod.id,{stock:newStock});setProduits(ps=>ps.map(p=>p.id===prod.id?{...p,stock:newStock}:p))}
      }
      const data={clientId,date,lignes:validLignes.map(l=>({produitId:l.produitId,qte:parseFloat(l.qte),prixUnit:parseFloat(l.prixUnit)||0})),statut:'en_cours',paiementRecu:0}
      const id=await addItem(COLS.commandes,data)
      setCommandes(cs=>[{id,...data},...cs])
      setModal(false);showToast('Commande créée ✓')
    }catch(e){showToast(e.message,'error')}
    finally{setSaving(false)}
  }

  async function markLivree(id){
    await updateItem(COLS.commandes,id,{statut:'livree'})
    setCommandes(cs=>cs.map(c=>c.id===id?{...c,statut:'livree'}:c))
    showToast('Commande livrée ✓')
  }

  async function handleDelete(id){
    if(!confirm('Supprimer cette commande ?'))return
    await deleteItem(COLS.commandes,id)
    setCommandes(cs=>cs.filter(c=>c.id!==id))
    showToast('Commande supprimée')
  }

  const columns = [
    { key:'date',      label:'Date',    render: r => fmtDate(r.date) },
    { key:'clientNom', label:'Client',  render: r => <strong>{r.clientNom}</strong> },
    { key:'zone',      label:'Zone',    render: r => <span className="badge-zone">{r.zone}</span> },
    { key:'total',     label:'Total',   render: r => <span className="amount-warn">{MAD(r.total)}</span> },
    { key:'paiementRecu', label:'Payé', render: r => <span className="amount-pos">{MAD(r.paiementRecu||0)}</span> },
    { key:'restant',   label:'Restant', render: r => <span className={r.restant>0?'amount-neg':'amount-pos'}>{MAD(r.restant)}</span> },
    { key:'statut',    label:'Statut',  render: r => r.statut==='en_cours'?<span className="badge-encours">En cours</span>:<span className="badge-ok">Livrée</span> },
    { key:'actions',   label:'', sortable:false, render: r => (
      <div className="d-flex gap-1">
        {r.statut==='en_cours'&&<button className="btn-icon" title="Marquer livrée" onClick={()=>markLivree(r.id)}><i className="bi bi-check-lg"></i></button>}
        <button className="btn-icon btn-danger" onClick={()=>handleDelete(r.id)}><i className="bi bi-trash"></i></button>
      </div>
    )},
  ]

  if(loading)return<div className="loading-box"><div className="spinner-agro"></div><p>Chargement commandes...</p></div>

  return(
    <div>
      <div className="row g-3 mb-3">
        {[
          {label:'Total Commandes',val:commandes.length,cls:''},
          {label:"Chiffre d'Affaires",val:MAD(totalCA),cls:'amount-pos'},
          {label:'En Cours',val:commandes.filter(c=>c.statut==='en_cours').length,cls:'amount-neg'},
          {label:'Livrées',val:commandes.filter(c=>c.statut==='livree').length,cls:''},
        ].map(s=>(
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="stat-box"><span className={`stat-val ${s.cls}`}>{s.val}</span><span className="stat-label">{s.label}</span></div>
          </div>
        ))}
      </div>

      <div className="page-header-agro">
        <div className="d-flex gap-2 flex-wrap">
          <select className="form-control-agro" style={{width:'auto'}} value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="en_cours">En cours</option>
            <option value="livree">Livrée</option>
          </select>
          {search&&<span style={{fontSize:12,color:'var(--text-soft)',alignSelf:'center'}}>Filtre: "{search}"</span>}
        </div>
        <button className="btn-primary-agro" onClick={openModal}><i className="bi bi-plus-lg"></i> Nouvelle Commande</button>
      </div>

      <div className="card-agro">
        <SortableTable columns={columns} data={filtered} emptyMsg="Aucune commande trouvée" />
      </div>

      {modal&&(
        <div className="modal-overlay-agro" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal-agro modal-lg" style={{maxHeight:'90vh',overflowY:'auto'}}>
            <div className="modal-title-agro"><i className="bi bi-receipt" style={{color:'var(--primary)'}}></i>Nouvelle Commande</div>
            <div className="row g-3 mb-3">
              <div className="col-7"><label className="form-label-agro">Client *</label><select className="form-control-agro" value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">-- Sélectionner --</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nom} ({c.zone})</option>)}</select></div>
              <div className="col-5"><label className="form-label-agro">Date *</label><input className="form-control-agro" type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
            </div>
            <label className="form-label-agro mb-2">Produits *</label>
            {lignes.map((l,i)=>(
              <div key={i} className="d-flex gap-2 mb-2 align-items-center">
                <select className="form-control-agro" style={{flex:2}} value={l.produitId} onChange={e=>updateLigne(i,'produitId',e.target.value)}><option value="">-- Produit --</option>{produits.map(p=><option key={p.id} value={p.id}>{p.nom} (Stock:{p.stock})</option>)}</select>
                <input className="form-control-agro" style={{flex:1}} type="number" min="1" placeholder="Qté" value={l.qte} onChange={e=>updateLigne(i,'qte',e.target.value)} />
                <input className="form-control-agro" style={{flex:1}} type="number" min="0" placeholder="Prix/u" value={l.prixUnit} onChange={e=>updateLigne(i,'prixUnit',e.target.value)} />
                <button className="btn-icon btn-danger" onClick={()=>removeLigne(i)} disabled={lignes.length===1}><i className="bi bi-x-lg"></i></button>
              </div>
            ))}
            <button className="btn-outline-agro w-100 mb-3" onClick={addLigne}><i className="bi bi-plus"></i> Ajouter produit</button>
            <div style={{background:'var(--bg)',borderRadius:8,padding:'12px 16px',textAlign:'right'}}>
              Total : <strong style={{fontFamily:'Syne,sans-serif',fontSize:20,color:'var(--primary)'}}>{MAD(totalCmd)}</strong>
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