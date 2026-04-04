import { useEffect, useState } from 'react'
import { getAll, addItem, updateItem, COLS, MAD, fmtDate } from '../firebase'

const CAT_COLORS = { Engrais:'#7B0D1E', Semences:'#3D9970', Phytosanitaires:'#E8C547', Machinerie:'#6B7280' }
const EMPTY_ARR = { produitId:'', date: new Date().toISOString().split('T')[0], qte:'', prixAchat:'', fournisseur:'' }

export default function Stock({ showToast }) {
  const [produits, setProduits]   = useState([])
  const [arrivages, setArrivages] = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('stock')
  const [search, setSearch]       = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [modalArr, setModalArr]   = useState(false)
  const [modalAjust, setModalAjust] = useState(false)
  const [formArr, setFormArr]     = useState(EMPTY_ARR)
  const [ajustProd, setAjustProd] = useState(null)
  const [ajustVal, setAjustVal]   = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    Promise.all([getAll(COLS.produits), getAll(COLS.arrivages)])
      .then(([p, a]) => { setProduits(p); setArrivages(a) })
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const alertes    = produits.filter(p => p.stock <= p.stockMin)
  const valeur     = produits.reduce((s,p) => s + p.stock * p.prixBase, 0)
  const arrMois    = arrivages.filter(a => new Date(a.date).getMonth() === new Date().getMonth()).length
  const filtered   = produits.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()) && (!filterCat || p.categorie === filterCat))

  async function saveArrivage() {
    if (!formArr.produitId || !formArr.qte || !formArr.date) return showToast('Champs obligatoires', 'error')
    setSaving(true)
    try {
      const data = { ...formArr, qte: parseInt(formArr.qte), prixAchat: parseFloat(formArr.prixAchat)||0 }
      const prod = produits.find(p => p.id === data.produitId)
      if (prod) {
        const newStock = prod.stock + data.qte
        await updateItem(COLS.produits, prod.id, { stock: newStock })
        setProduits(ps => ps.map(p => p.id === prod.id ? { ...p, stock: newStock } : p))
      }
      const id = await addItem(COLS.arrivages, data)
      setArrivages(as => [{ id, ...data }, ...as])
      setModalArr(false)
      showToast('Arrivage enregistré ✓')
    } catch(e) { showToast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function saveAjust() {
    const nouveau = parseInt(ajustVal)
    if (isNaN(nouveau) || nouveau < 0) return showToast('Valeur invalide', 'error')
    setSaving(true)
    try {
      await updateItem(COLS.produits, ajustProd.id, { stock: nouveau })
      setProduits(ps => ps.map(p => p.id === ajustProd.id ? { ...p, stock: nouveau } : p))
      setModalAjust(false)
      showToast('Stock ajusté ✓')
    } catch(e) { showToast(e.message, 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading-box"><div className="spinner-agro"></div><p>Chargement stock...</p></div>

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-3">
        {[
          { label:'Références',        val: produits.length,  cls:'' },
          { label:'Alertes Rupture',   val: alertes.length,   cls: alertes.length > 0 ? 'amount-neg' : 'amount-pos' },
          { label:'Valeur Stock',      val: MAD(valeur),      cls:'amount-pos' },
          { label:'Arrivages ce mois', val: arrMois,          cls:'' },
        ].map(s => (
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="stat-box"><span className={`stat-val ${s.cls}`}>{s.val}</span><span className="stat-label">{s.label}</span></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs-agro">
        {[['stock','📦 État du Stock'],['arrivages','🚛 Arrivages'],['alertes','⚠ Alertes']].map(([t,l]) => (
          <button key={t} className={`tab-btn-agro ${tab===t?'active':''}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* TAB STOCK */}
      {tab === 'stock' && (
        <>
          <div className="page-header-agro">
            <div className="d-flex gap-2">
              <div className="search-wrap"><i className="bi bi-search"></i><input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} /></div>
              <select className="form-control-agro" style={{ width:'auto' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">Toutes catégories</option>
                {['Engrais','Semences','Phytosanitaires','Machinerie'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="card-agro">
            <div className="table-responsive">
              <table className="table-agro">
                <thead><tr><th>Produit</th><th>Catégorie</th><th>Stock</th><th>Min</th><th>Prix Base</th><th>Valeur</th><th>Statut</th><th>Ajuster</th></tr></thead>
                <tbody>
                  {filtered.map(p => {
                    const alerte = p.stock <= p.stockMin
                    const pct = Math.min(100, Math.round(p.stock / Math.max(p.stockMin*3,1)*100))
                    const col = CAT_COLORS[p.categorie] || '#6B7280'
                    return (
                      <tr key={p.id}>
                        <td><strong>{p.nom}</strong><div style={{ fontSize:11, color:'var(--text-soft)' }}>{p.unite}</div></td>
                        <td><span style={{ background:`${col}18`, color:col, fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:4 }}>{p.categorie}</span></td>
                        <td>
                          <strong style={{ color: alerte ? 'var(--accent-danger)' : 'var(--text-main)' }}>{p.stock}</strong>
                          <div style={{ width:70, height:4, background:'var(--border)', borderRadius:2, marginTop:4 }}>
                            <div style={{ width:`${pct}%`, height:'100%', background: alerte ? 'var(--accent-danger)' : 'var(--primary)', borderRadius:2 }}></div>
                          </div>
                        </td>
                        <td style={{ color:'var(--text-soft)' }}>{p.stockMin}</td>
                        <td>{(p.prixBase||0).toLocaleString('fr-MA')} MAD</td>
                        <td className={p.stock > 0 ? 'amount-pos' : 'amount-neg'}>{MAD(p.stock * p.prixBase)}</td>
                        <td>{alerte ? <span className="badge-retard">⚠ Critique</span> : <span className="badge-ok">✓ OK</span>}</td>
                        <td>
                          <button className="btn-icon" onClick={() => { setAjustProd(p); setAjustVal(p.stock); setModalAjust(true) }}>
                            <i className="bi bi-sliders"></i>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB ARRIVAGES */}
      {tab === 'arrivages' && (
        <>
          <div className="page-header-agro">
            <span></span>
            <button className="btn-primary-agro" onClick={() => { setFormArr(EMPTY_ARR); setModalArr(true) }}>
              <i className="bi bi-plus-lg"></i> Nouvel Arrivage
            </button>
          </div>
          <div className="card-agro">
            <div className="table-responsive">
              <table className="table-agro">
                <thead><tr><th>Date</th><th>Produit</th><th>Qté Reçue</th><th>Prix Achat/u</th><th>Valeur</th><th>Fournisseur</th></tr></thead>
                <tbody>
                  {[...arrivages].sort((a,b) => new Date(b.date)-new Date(a.date)).map(a => {
                    const prod = produits.find(p => p.id === a.produitId)
                    return (
                      <tr key={a.id}>
                        <td>{fmtDate(a.date)}</td>
                        <td><strong>{prod ? prod.nom : '?'}</strong></td>
                        <td className="amount-pos">+{a.qte}</td>
                        <td>{a.prixAchat ? a.prixAchat.toLocaleString('fr-MA')+' MAD' : '—'}</td>
                        <td className="amount-warn">{a.prixAchat ? MAD(a.qte * a.prixAchat) : '—'}</td>
                        <td style={{ color:'var(--text-soft)' }}>{a.fournisseur||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB ALERTES */}
      {tab === 'alertes' && (
        <div className="row g-3">
          {alertes.length === 0
            ? <div className="col-12 text-center p-5" style={{ color:'var(--accent-green)', fontSize:18 }}>✅ Tous les stocks sont au-dessus du minimum</div>
            : alertes.map(p => (
              <div className="col-md-4" key={p.id}>
                <div className="card-agro p-3">
                  <div style={{ fontSize:11, color:'var(--accent-danger)', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>⚠ Rupture imminente</div>
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:16, marginBottom:8 }}>{p.nom}</div>
                  <div style={{ fontSize:13, marginBottom:12 }}>
                    <span style={{ color:'var(--accent-danger)' }}>Stock : <strong>{p.stock} {p.unite}</strong></span><br/>
                    <span style={{ color:'var(--text-soft)' }}>Minimum : <strong>{p.stockMin}</strong></span>
                  </div>
                  <button className="btn-primary-agro w-100" onClick={() => { setFormArr({ ...EMPTY_ARR, produitId: p.id }); setModalArr(true); setTab('arrivages') }}>
                    <i className="bi bi-plus-lg"></i> Arrivage
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Modal Arrivage */}
      {modalArr && (
        <div className="modal-overlay-agro" onClick={e => e.target === e.currentTarget && setModalArr(false)}>
          <div className="modal-agro">
            <div className="modal-title-agro"><i className="bi bi-truck" style={{ color:'var(--primary)' }}></i>Nouvel Arrivage</div>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label-agro">Produit *</label>
                <select className="form-control-agro" value={formArr.produitId} onChange={e => setFormArr(f=>({...f,produitId:e.target.value}))}>
                  <option value="">-- Sélectionner --</option>
                  {produits.map(p => <option key={p.id} value={p.id}>{p.nom} (Stock: {p.stock})</option>)}
                </select>
              </div>
              <div className="col-6"><label className="form-label-agro">Date *</label><input className="form-control-agro" type="date" value={formArr.date} onChange={e => setFormArr(f=>({...f,date:e.target.value}))} /></div>
              <div className="col-6"><label className="form-label-agro">Quantité *</label><input className="form-control-agro" type="number" min="1" value={formArr.qte} onChange={e => setFormArr(f=>({...f,qte:e.target.value}))} placeholder="100" /></div>
              <div className="col-6"><label className="form-label-agro">Prix Achat/u</label><input className="form-control-agro" type="number" min="0" value={formArr.prixAchat} onChange={e => setFormArr(f=>({...f,prixAchat:e.target.value}))} placeholder="250" /></div>
              <div className="col-6"><label className="form-label-agro">Fournisseur</label><input className="form-control-agro" value={formArr.fournisseur} onChange={e => setFormArr(f=>({...f,fournisseur:e.target.value}))} placeholder="AgriChim SA" /></div>
            </div>
            <div className="modal-footer-agro">
              <button className="btn-outline-agro" onClick={() => setModalArr(false)}>Annuler</button>
              <button className="btn-primary-agro" onClick={saveArrivage} disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Enregistrement...</> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustement */}
      {modalAjust && ajustProd && (
        <div className="modal-overlay-agro" onClick={e => e.target === e.currentTarget && setModalAjust(false)}>
          <div className="modal-agro" style={{ maxWidth:400 }}>
            <div className="modal-title-agro"><i className="bi bi-sliders" style={{ color:'var(--primary)' }}></i>Ajuster le Stock</div>
            <div className="mb-3"><label className="form-label-agro">Produit</label><input className="form-control-agro" value={ajustProd.nom} readOnly style={{ opacity:0.7 }} /></div>
            <div className="mb-3"><label className="form-label-agro">Stock Actuel</label><input className="form-control-agro" value={`${ajustProd.stock} ${ajustProd.unite}`} readOnly style={{ opacity:0.7 }} /></div>
            <div className="mb-3"><label className="form-label-agro">Nouveau Stock *</label><input className="form-control-agro" type="number" min="0" value={ajustVal} onChange={e => setAjustVal(e.target.value)} /></div>
            <div className="modal-footer-agro">
              <button className="btn-outline-agro" onClick={() => setModalAjust(false)}>Annuler</button>
              <button className="btn-primary-agro" onClick={saveAjust} disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Enregistrement...</> : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}