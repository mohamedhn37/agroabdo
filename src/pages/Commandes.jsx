import { useEffect, useState, useMemo } from 'react'
import SortableTable from '../components/SortableTable'
import { getAll, addItem, updateItem, deleteItem, getTotal, COLS, MAD, fmtDate } from '../firebase'
import { getCatConfig } from '../config/categories'

const EMPTY_LIGNE = { produitId:'', qte:'', prixUnit:'' }

export default function Commandes({ showToast, search }) {
  const [commandes, setCommandes] = useState([])
  const [clients, setClients]     = useState([])
  const [produits, setProduits]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterStatut, setFilterStatut] = useState('')
  const [modal, setModal]         = useState(false)
  const [saving, setSaving]       = useState(false)
  // ── Form nouvelle commande ────────────────────────────────────────────────
  const [clientId, setClientId]   = useState('')
  const [clientSearch, setClientSearch] = useState('')  // #4 recherche client
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [lignes, setLignes]       = useState([{...EMPTY_LIGNE}])
  // ── Sélection multiple ────────────────────────────────────────────────────
  const [selected, setSelected]   = useState(new Set())
  const [deleting, setDeleting]   = useState(false)

  useEffect(() => {
    Promise.all([getAll(COLS.commandes),getAll(COLS.clients),getAll(COLS.produits),getAll(COLS.paiements)])
      .then(([cmd,cl,pr]) => { setCommandes(cmd); setClients(cl); setProduits(pr) })
      .catch(e=>showToast(e.message,'error'))
      .finally(()=>setLoading(false))
  }, [])

  const enriched = useMemo(() => commandes.map(c => {
    const cl    = clients.find(x=>x.id===c.clientId)
    const total = getTotal(c)
    return { ...c, clientNom:cl?cl.nom:'?', zone:cl?cl.zone:'—', total, restant:total-(c.paiementRecu||0) }
  }), [commandes, clients])

  const filtered = useMemo(() => enriched.filter(c =>
    (!search || c.clientNom.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatut || c.statut === filterStatut)
  ).sort((a,b)=>new Date(b.date)-new Date(a.date)), [enriched, search, filterStatut])

  const totalCA = commandes.reduce((s,c)=>s+getTotal(c),0)

  // ── Clients filtrés pour la recherche dans modal ──────────────────────────
  const clientsFiltered = useMemo(() => {
    if (!clientSearch.trim()) return clients
    const q = clientSearch.toLowerCase()
    return clients.filter(c =>
      c.nom.toLowerCase().includes(q) ||
      (c.ville||'').toLowerCase().includes(q) ||
      (c.ice||'').includes(q)
    )
  }, [clients, clientSearch])

  // ── Select all ───────────────────────────────────────────────────────────
  const allFilteredIds = filtered.map(c => c.id)
  const allSelected    = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id))

  function toggleAll() {
    if (allSelected) {
      setSelected(s => { const n=new Set(s); allFilteredIds.forEach(id=>n.delete(id)); return n })
    } else {
      setSelected(s => { const n=new Set(s); allFilteredIds.forEach(id=>n.add(id)); return n })
    }
  }
  function toggleOne(id) {
    setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  }

  async function deleteSelected() {
    if (!selected.size) return
    if (!confirm(`Supprimer ${selected.size} commande(s) ?`)) return
    setDeleting(true)
    try {
      await Promise.all([...selected].map(id=>deleteItem(COLS.commandes,id)))
      setCommandes(cs=>cs.filter(c=>!selected.has(c.id)))
      setSelected(new Set())
      showToast(`${selected.size} commande(s) supprimée(s) ✓`)
    } catch(e) { showToast(e.message,'error') }
    finally { setDeleting(false) }
  }

  // ── Lignes helpers ────────────────────────────────────────────────────────
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

  function openModal(){
    setClientId(''); setClientSearch('')
    setDate(new Date().toISOString().split('T')[0])
    setLignes([{...EMPTY_LIGNE}]); setModal(true)
  }

  async function handleSave(){
    if(!clientId||!date)return showToast('Client et date obligatoires','error')
    const validLignes=lignes.filter(l=>l.produitId&&parseFloat(l.qte)>0)
    if(!validLignes.length)return showToast('Ajouter au moins un produit valide','error')
    setSaving(true)
    try{
      for(const l of validLignes){
        const prod=produits.find(p=>p.id===l.produitId)
        if(prod){
          const newStock=Math.max(0,prod.stock-parseFloat(l.qte))
          await updateItem(COLS.produits,prod.id,{stock:newStock})
          setProduits(ps=>ps.map(p=>p.id===prod.id?{...p,stock:newStock}:p))
        }
      }
      const data={clientId,date,lignes:validLignes.map(l=>({produitId:l.produitId,qte:parseFloat(l.qte),prixUnit:parseFloat(l.prixUnit)||0})),statut:'en_cours',paiementRecu:0}
      const id=await addItem(COLS.commandes,data)
      setCommandes(cs=>[{id,...data},...cs])
      setModal(false); showToast('Commande créée ✓')
    }catch(e){showToast(e.message,'error')}
    finally{setSaving(false)}
  }

  async function markLivree(id){
    await updateItem(COLS.commandes,id,{statut:'livree'})
    setCommandes(cs=>cs.map(c=>c.id===id?{...c,statut:'livree'}:c))
    showToast('Commande livrée ✓')
  }

  async function handleDeleteOne(id){
    if(!confirm('Supprimer cette commande ?'))return
    await deleteItem(COLS.commandes,id)
    setCommandes(cs=>cs.filter(c=>c.id!==id))
    setSelected(s=>{const n=new Set(s);n.delete(id);return n})
    showToast('Commande supprimée')
  }

  const columns = [
    { key:'__check', label:(
        <input type="checkbox" checked={allSelected} onChange={toggleAll}
          style={{ accentColor:'var(--primary)', width:15, height:15, cursor:'pointer' }} />
      ), sortable:false,
      render: r => (
        <input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleOne(r.id)}
          style={{ accentColor:'var(--primary)', width:15, height:15, cursor:'pointer' }} />
      )
    },
    { key:'date',        label:'Date',    render: r => fmtDate(r.date) },
    { key:'clientNom',   label:'Client',  render: r => <strong>{r.clientNom}</strong> },
    { key:'zone',        label:'Zone',    render: r => <span className="badge-zone">{r.zone}</span> },
    { key:'total',       label:'Total',   render: r => <span className="amount-warn">{MAD(r.total)}</span> },
    { key:'paiementRecu',label:'Payé',    render: r => <span className="amount-pos">{MAD(r.paiementRecu||0)}</span> },
    { key:'restant',     label:'Restant', render: r => <span className={r.restant>0?'amount-neg':'amount-pos'}>{MAD(r.restant)}</span> },
    { key:'statut',      label:'Statut',  render: r => r.statut==='en_cours'?<span className="badge-encours">En cours</span>:<span className="badge-ok">Livrée</span> },
    { key:'actions', label:'', sortable:false, render: r => (
      <div className="d-flex gap-1">
        {r.statut==='en_cours'&&<button className="btn-icon" title="Marquer livrée" onClick={()=>markLivree(r.id)}><i className="bi bi-check-lg"></i></button>}
        <button className="btn-icon btn-danger" onClick={()=>handleDeleteOne(r.id)}><i className="bi bi-trash"></i></button>
      </div>
    )},
  ]

  if(loading)return<div className="loading-box"><div className="spinner-agro"></div><p>Chargement commandes...</p></div>

  return(
    <div>
      <div className="row g-3 mb-3">
        {[
          { label:'Total Commandes',   val:commandes.length, cls:'' },
          { label:"Chiffre d'Affaires",val:MAD(totalCA),     cls:'amount-pos' },
          { label:'En Cours',          val:commandes.filter(c=>c.statut==='en_cours').length, cls:'amount-neg' },
          { label:'Livrées',           val:commandes.filter(c=>c.statut==='livree').length,   cls:'' },
        ].map(s=>(
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="stat-box"><span className={`stat-val ${s.cls}`}>{s.val}</span><span className="stat-label">{s.label}</span></div>
          </div>
        ))}
      </div>

      <div className="page-header-agro">
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <select className="form-control-agro" style={{ width:'auto' }} value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="en_cours">En cours</option>
            <option value="livree">Livrée</option>
          </select>
          {search&&<span style={{ fontSize:12,color:'var(--text-soft)',alignSelf:'center' }}>Filtre: "{search}"</span>}
        </div>
        <div className="d-flex gap-2">
          {selected.size > 0 && (
            <button className="btn-outline-agro d-flex align-items-center gap-2"
              style={{ borderColor:'var(--accent-danger)', color:'var(--accent-danger)' }}
              onClick={deleteSelected} disabled={deleting}>
              {deleting?<><span className="spinner-border spinner-border-sm"></span> Suppression...</>
                :<><i className="bi bi-trash3-fill"></i> Supprimer ({selected.size})</>}
            </button>
          )}
          <button className="btn-primary-agro" onClick={openModal}><i className="bi bi-plus-lg"></i> Nouvelle Commande</button>
        </div>
      </div>

      <div className="card-agro">
        <SortableTable columns={columns} data={filtered} emptyMsg="Aucune commande trouvée" />
      </div>

      {/* Modal Nouvelle Commande */}
      {modal&&(
        <div className="modal-overlay-agro" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal-agro modal-lg" style={{ maxHeight:'90vh', overflowY:'auto' }}>
            <div className="modal-title-agro"><i className="bi bi-receipt" style={{ color:'var(--primary)' }}></i>Nouvelle Commande</div>

            <div className="row g-3 mb-3">
              {/* ── #4 Recherche client ─────────────────────────────────── */}
              <div className="col-12">
                <label className="form-label-agro">Client * <span style={{ color:'var(--text-soft)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>— recherche par nom, ville ou ICE</span></label>
                <div style={{ position:'relative' }}>
                  <i className="bi bi-search" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-soft)', fontSize:13 }}></i>
                  <input
                    className="form-control-agro"
                    style={{ paddingLeft:34 }}
                    placeholder="Taper pour filtrer les clients..."
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setClientId('') }}
                  />
                </div>

                {/* Liste clients filtrée */}
                <div style={{ maxHeight:180, overflowY:'auto', border:'1px solid var(--border)', borderRadius:8, marginTop:4, background:'var(--bg)' }}>
                  {clientsFiltered.length === 0
                    ? <div style={{ padding:'12px 14px', fontSize:12, color:'var(--text-soft)' }}>Aucun client trouvé</div>
                    : clientsFiltered.map(c => (
                      <div key={c.id}
                        onClick={() => { setClientId(c.id); setClientSearch(c.nom) }}
                        style={{
                          padding:'10px 14px', cursor:'pointer', fontSize:13,
                          background: clientId===c.id ? 'var(--primary-ultra)' : 'transparent',
                          borderLeft: clientId===c.id ? '3px solid var(--primary)' : '3px solid transparent',
                          transition:'all 0.15s',
                          display:'flex', justifyContent:'space-between', alignItems:'center',
                        }}
                        onMouseOver={e=>e.currentTarget.style.background='var(--primary-ultra)'}
                        onMouseOut={e=>e.currentTarget.style.background=clientId===c.id?'var(--primary-ultra)':'transparent'}
                      >
                        <div>
                          <strong>{c.nom}</strong>
                          <span style={{ fontSize:11, color:'var(--text-soft)', marginLeft:8 }}>{c.ville} — {c.zone}</span>
                        </div>
                        {clientId===c.id && <i className="bi bi-check-circle-fill" style={{ color:'var(--primary)', fontSize:14 }}></i>}
                      </div>
                    ))
                  }
                </div>
                {clientId && (
                  <div style={{ marginTop:6, fontSize:12, color:'var(--accent-green)' }}>
                    <i className="bi bi-check-circle me-1"></i>
                    Client sélectionné : <strong>{clients.find(c=>c.id===clientId)?.nom}</strong>
                  </div>
                )}
              </div>

              <div className="col-5">
                <label className="form-label-agro">Date *</label>
                <input className="form-control-agro" type="date" value={date} onChange={e=>setDate(e.target.value)} />
              </div>
            </div>

            {/* Lignes produits */}
            <label className="form-label-agro mb-2">Produits *</label>
            {lignes.map((l,i)=>(
              <div key={i} className="d-flex gap-2 mb-2 align-items-center">
                <select className="form-control-agro" style={{ flex:2 }} value={l.produitId} onChange={e=>updateLigne(i,'produitId',e.target.value)}>
                  <option value="">-- Produit --</option>
                  {produits.map(p=>{
                    const cfg=getCatConfig(p.categorie)
                    return <option key={p.id} value={p.id}>[{p.categorie}] {p.nom} — Stock: {p.stock}</option>
                  })}
                </select>
                <input className="form-control-agro" style={{ flex:1 }} type="number" min="1" placeholder="Qté" value={l.qte} onChange={e=>updateLigne(i,'qte',e.target.value)} />
                <input className="form-control-agro" style={{ flex:1 }} type="number" min="0" placeholder="Prix/u" value={l.prixUnit} onChange={e=>updateLigne(i,'prixUnit',e.target.value)} />
                <button className="btn-icon btn-danger" onClick={()=>removeLigne(i)} disabled={lignes.length===1}><i className="bi bi-x-lg"></i></button>
              </div>
            ))}
            <button className="btn-outline-agro w-100 mb-3" onClick={addLigne}><i className="bi bi-plus"></i> Ajouter produit</button>

            <div style={{ background:'var(--bg)', borderRadius:8, padding:'12px 16px', textAlign:'right' }}>
              Total : <strong style={{ fontFamily:'Syne,sans-serif', fontSize:20, color:'var(--primary)' }}>{MAD(totalCmd)}</strong>
            </div>

            <div className="modal-footer-agro">
              <button className="btn-outline-agro" onClick={()=>setModal(false)}>Annuler</button>
              <button className="btn-primary-agro" onClick={handleSave} disabled={saving||!clientId}>
                {saving?<><span className="spinner-border spinner-border-sm me-2"></span>Enregistrement...</>:'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}