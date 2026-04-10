import { useEffect, useState, useMemo } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { getAll, addItem, updateItem, deleteItem, getTotal, COLS, MAD, fmtDate } from '../firebase'

ChartJS.register(ArcElement, Tooltip, Legend)

const MODES_PAIEMENT = ['Espèces', 'Chèque', 'Virement', 'Traite']

function getStatutsMontants(clientId, commandes, paiements) {
  const cmds      = commandes.filter(c => c.clientId === clientId)
  const totalDu   = cmds.reduce((s, c) => s + getTotal(c), 0)
  const cPay      = paiements.filter(p => p.clientId === clientId)
  const encaisse  = cPay.filter(p => p.statut === 'encaisse' || !p.statut).reduce((s,p) => s+p.montant, 0)
  const vnv       = cPay.filter(p => p.statut === 'vnv').reduce((s,p) => s+p.montant, 0)
  const nonPaye   = Math.max(0, totalDu - encaisse - vnv)
  return { totalDu, encaisse, vnv, nonPaye }
}

function getGlobalMontants(clients, commandes, paiements, clientIdFilter = null) {
  const list = clientIdFilter ? clients.filter(c => c.id === clientIdFilter) : clients
  let encaisse=0, vnv=0, nonPaye=0, totalDu=0
  list.forEach(c => {
    const s = getStatutsMontants(c.id, commandes, paiements)
    encaisse += s.encaisse; vnv += s.vnv; nonPaye += s.nonPaye; totalDu += s.totalDu
  })
  return { encaisse, vnv, nonPaye, totalDu }
}

export default function Recouvrement({ showToast }) {
  const [clients, setClients]     = useState([])
  const [commandes, setCommandes] = useState([])
  const [paiements, setPaiements] = useState([])
  const [loading, setLoading]     = useState(true)
  const [selectedClient, setSelectedClient] = useState(null)
  const [periode, setPeriode]     = useState('all')

  // Modal nouveau paiement
  const [modal, setModal]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({
    clientId:'', commandeId:'', date: new Date().toISOString().split('T')[0],
    montant:'', mode:'Espèces', statut:'encaisse', dateEcheance:'', ref:''
  })
  const [clientCmds, setClientCmds] = useState([])

  // Modal modifier paiement
  const [editModal, setEditModal]   = useState(false)
  const [editForm, setEditForm]     = useState(null)
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    Promise.all([getAll(COLS.clients), getAll(COLS.commandes), getAll(COLS.paiements)])
      .then(([cl,cmd,pa]) => { setClients(cl); setCommandes(cmd); setPaiements(pa) })
      .catch(e => showToast(e.message,'error'))
      .finally(() => setLoading(false))
  }, [])

  // ── Filtre période ─────────────────────────────────────────────────────────
  const paiementsFiltres = useMemo(() => {
    if (periode === 'all') return paiements
    const now=new Date(), year=now.getFullYear(), month=now.getMonth()
    return paiements.filter(p => {
      const d = new Date(p.date)
      if (periode==='mois')  return d.getMonth()===month && d.getFullYear()===year
      if (periode==='trim')  return Math.floor(d.getMonth()/3)===Math.floor(month/3) && d.getFullYear()===year
      if (periode==='annee') return d.getFullYear()===year
      return true
    })
  }, [paiements, periode])

  // ── Donut data ─────────────────────────────────────────────────────────────
  const donutData = useMemo(() =>
    getGlobalMontants(clients, commandes, paiementsFiltres, selectedClient),
  [clients, commandes, paiementsFiltres, selectedClient])

  const donutChartData = {
    labels: ['Encaissé','VNV','Non Payé'],
    datasets: [{ data:[donutData.encaisse, donutData.vnv, donutData.nonPaye],
      backgroundColor:['#3D9970','#E8A020','#C0392B'], borderWidth:0, hoverOffset:6 }]
  }
  const donutOptions = {
    responsive: true,
    plugins: {
      legend: { position:'bottom', labels:{ color:'var(--text-soft)', font:{ family:'DM Sans', size:12 }, padding:16 } },
      tooltip: { callbacks:{ label: c => ` ${c.label}: ${MAD(c.raw)} (${donutData.totalDu>0?Math.round(c.raw/donutData.totalDu*100):0}%)` } }
    }
  }

  // ── Rows clients ───────────────────────────────────────────────────────────
  const rows = useMemo(() => clients.map(c => {
    const { totalDu, encaisse, vnv, nonPaye } = getStatutsMontants(c.id, commandes, paiementsFiltres)
    const lastCmd = commandes.filter(cmd=>cmd.clientId===c.id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0]
    const retard  = lastCmd ? Math.floor((new Date()-new Date(lastCmd.date))/86400000) : 0
    return { ...c, totalDu, encaisse, vnv, nonPaye, retard }
  }).sort((a,b)=>b.nonPaye-a.nonPaye), [clients, commandes, paiementsFiltres])

  // ── Nouveau paiement ───────────────────────────────────────────────────────
  function openModal(clientId='') {
    const f = { clientId, commandeId:'', date:new Date().toISOString().split('T')[0],
      montant:'', mode:'Espèces', statut:'encaisse', dateEcheance:'', ref:'' }
    if (clientId) {
      const {nonPaye} = getStatutsMontants(clientId, commandes, paiements)
      f.montant = Math.round(nonPaye)
      setClientCmds(commandes.filter(c=>c.clientId===clientId && (getTotal(c)-(c.paiementRecu||0))>0))
    } else { setClientCmds([]) }
    setForm(f); setModal(true)
  }

  function handleClientChange(cId) {
    const {nonPaye} = getStatutsMontants(cId, commandes, paiements)
    setForm(f=>({...f, clientId:cId, montant:Math.round(nonPaye), commandeId:''}))
    setClientCmds(commandes.filter(c=>c.clientId===cId && (getTotal(c)-(c.paiementRecu||0))>0))
  }

  async function handleSave() {
    if (!form.clientId||!form.montant||!form.date) return showToast('Champs obligatoires','error')
    if (form.statut==='vnv'&&!form.dateEcheance) return showToast("Date d'échéance obligatoire pour VNV",'error')
    setSaving(true)
    try {
      if (form.commandeId) {
        const cmd = commandes.find(c=>c.id===form.commandeId)
        if (cmd) {
          const newPaye = (cmd.paiementRecu||0)+parseFloat(form.montant)
          await updateItem(COLS.commandes, cmd.id, {paiementRecu:newPaye})
          setCommandes(cs=>cs.map(c=>c.id===cmd.id?{...c,paiementRecu:newPaye}:c))
        }
      }
      const data = { clientId:form.clientId, commandeId:form.commandeId||null,
        date:form.date, montant:parseFloat(form.montant), mode:form.mode,
        statut:form.statut, dateEcheance:form.statut==='vnv'?form.dateEcheance:null, ref:form.ref.trim() }
      const id = await addItem(COLS.paiements, data)
      setPaiements(ps=>[{id,...data},...ps])
      setModal(false)
      showToast('Paiement enregistré ✓')
    } catch(e) { showToast(e.message,'error') }
    finally { setSaving(false) }
  }

  // ── Convertir VNV → Encaissé ───────────────────────────────────────────────
  async function convertVNV(pay) {
    if (!confirm(`Convertir ce VNV de ${MAD(pay.montant)} en Encaissé ?\nLe chèque a été versé en banque.`)) return
    await updateItem(COLS.paiements, pay.id, { statut:'encaisse', dateEcheance:null })
    setPaiements(ps => ps.map(p => p.id===pay.id ? {...p, statut:'encaisse', dateEcheance:null} : p))
    showToast('VNV converti en Encaissé ✓')
  }

  // ── Modifier paiement ──────────────────────────────────────────────────────
  function openEditModal(pay) {
    setEditForm({ ...pay })
    setEditModal(true)
  }

  async function handleEditSave() {
    if (!editForm.montant||!editForm.date) return showToast('Champs obligatoires','error')
    if (editForm.statut==='vnv'&&!editForm.dateEcheance) return showToast("Date d'échéance obligatoire pour VNV",'error')
    setEditSaving(true)
    try {
      const data = {
        date:         editForm.date,
        montant:      parseFloat(editForm.montant),
        mode:         editForm.mode,
        statut:       editForm.statut,
        dateEcheance: editForm.statut==='vnv' ? editForm.dateEcheance : null,
        ref:          editForm.ref||'',
      }
      await updateItem(COLS.paiements, editForm.id, data)
      setPaiements(ps => ps.map(p => p.id===editForm.id ? {...p,...data} : p))
      setEditModal(false)
      showToast('Paiement modifié ✓')
    } catch(e) { showToast(e.message,'error') }
    finally { setEditSaving(false) }
  }

  // ── Supprimer paiement ─────────────────────────────────────────────────────
  async function handleDeletePay(pay) {
    const cl = clients.find(c=>c.id===pay.clientId)
    if (!confirm(`Supprimer ce paiement de ${MAD(pay.montant)} pour ${cl?.nom||'?'} ?\nCette action est irréversible.`)) return
    await deleteItem(COLS.paiements, pay.id)
    setPaiements(ps => ps.filter(p => p.id!==pay.id))
    showToast('Paiement supprimé')
  }

  if (loading) return <div className="loading-box"><div className="spinner-agro"></div><p>Chargement...</p></div>

  const globalStats = getGlobalMontants(clients, commandes, paiementsFiltres)

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-3">
        {[
          { label:'Total Crédit Accordé', val:MAD(globalStats.totalDu),  cls:'amount-warn' },
          { label:'🟢 Encaissé',          val:MAD(globalStats.encaisse), cls:'amount-pos'  },
          { label:'🟠 VNV (À encaisser)', val:MAD(globalStats.vnv),      cls:'',           style:{color:'#E8A020',fontWeight:700} },
          { label:'🔴 Non Payé',          val:MAD(globalStats.nonPaye),  cls:'amount-neg'  },
        ].map(s => (
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="stat-box">
              <span className={`stat-val ${s.cls}`} style={s.style}>{s.val}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filtre période */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <span style={{ fontSize:12, color:'var(--text-soft)', fontWeight:600 }}>Période :</span>
        {[['all','Toute période'],['mois','Ce mois'],['trim','Ce trimestre'],['annee','Cette année']].map(([val,lbl]) => (
          <button key={val} onClick={()=>setPeriode(val)}
            style={{ padding:'5px 14px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer',
              border:`1px solid ${periode===val?'var(--primary)':'var(--border)'}`,
              background:periode===val?'var(--primary)':'none',
              color:periode===val?'white':'var(--text-soft)',
              fontFamily:'var(--font-body)', transition:'all 0.2s' }}>{lbl}</button>
        ))}
        {selectedClient && (
          <button onClick={()=>setSelectedClient(null)}
            style={{ marginLeft:'auto', padding:'5px 14px', borderRadius:6, fontSize:12, fontWeight:600,
              cursor:'pointer', border:'1px solid var(--border)', background:'none',
              color:'var(--text-soft)', fontFamily:'var(--font-body)' }}>
            <i className="bi bi-x-circle me-1"></i>Voir tous les clients
          </button>
        )}
      </div>

      <div className="row g-3 mb-3">
        {/* Donut */}
        <div className="col-lg-4">
          <div className="card-agro h-100">
            <div className="card-header-agro">
              <span className="card-title-agro">
                {selectedClient ? `Recouvrement — ${clients.find(c=>c.id===selectedClient)?.nom}` : 'Répartition Recouvrement'}
              </span>
            </div>
            <div className="p-4">
              <Doughnut data={donutChartData} options={donutOptions} />
              <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { label:'Encaissé', val:donutData.encaisse, color:'#3D9970' },
                  { label:'VNV',      val:donutData.vnv,      color:'#E8A020' },
                  { label:'Non Payé', val:donutData.nonPaye,  color:'#C0392B' },
                ].map(s => (
                  <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', background:'var(--bg)', borderRadius:7, fontSize:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:10, height:10, borderRadius:'50%', background:s.color, display:'inline-block' }}></span>
                      <span style={{ color:'var(--text-soft)' }}>{s.label}</span>
                    </div>
                    <strong style={{ color:s.color }}>{MAD(s.val)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tableau clients */}
        <div className="col-lg-8">
          <div className="card-agro h-100">
            <div className="card-header-agro">
              <span className="card-title-agro">Situation par Client</span>
              <button className="btn-primary-agro" onClick={()=>openModal()}>
                <i className="bi bi-plus-lg"></i> Enregistrer Paiement
              </button>
            </div>
            <div className="table-responsive">
              <table className="table-agro">
                <thead>
                  <tr><th>Client</th><th>Zone</th><th>Total Dû</th><th style={{color:'#3D9970'}}>Encaissé</th><th style={{color:'#E8A020'}}>VNV</th><th style={{color:'#C0392B'}}>Non Payé</th><th>Retard</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}
                      onClick={()=>setSelectedClient(s=>s===r.id?null:r.id)}
                      style={{ cursor:'pointer', background:selectedClient===r.id?'var(--primary-ultra)':'transparent',
                        borderLeft:selectedClient===r.id?'3px solid var(--primary)':'3px solid transparent', transition:'all 0.15s' }}>
                      <td><strong>{r.nom}</strong></td>
                      <td><span className="badge-zone">{r.zone}</span></td>
                      <td className="amount-warn">{MAD(r.totalDu)}</td>
                      <td><span style={{color:'#3D9970',fontWeight:600}}>{MAD(r.encaisse)}</span></td>
                      <td>
                        {r.vnv>0
                          ? <span style={{background:'rgba(232,160,32,0.12)',color:'#E8A020',fontWeight:700,padding:'2px 8px',borderRadius:5,fontSize:11.5}}>{MAD(r.vnv)}</span>
                          : <span style={{color:'var(--text-soft)'}}>—</span>}
                      </td>
                      <td>
                        {r.nonPaye>0 ? <span className="badge-retard">{MAD(r.nonPaye)}</span> : <span className="badge-ok">Soldé</span>}
                      </td>
                      <td>
                        {r.nonPaye>0||r.vnv>0 ? <span className="badge-retard">{r.retard}j</span> : <span className="badge-ok">✓</span>}
                      </td>
                      <td onClick={e=>e.stopPropagation()}>
                        {(r.nonPaye>0||r.vnv>0) && (
                          <button className="btn-icon" onClick={()=>openModal(r.id)}>
                            <i className="bi bi-cash-coin"></i> Paiement
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Historique paiements */}
      <div className="card-agro">
        <div className="card-header-agro">
          <span className="card-title-agro">Historique des Paiements</span>
          <span style={{fontSize:11,color:'var(--text-soft)',fontStyle:'italic'}}>
            <i className="bi bi-info-circle me-1"></i>
            Cliquer sur 🟠 VNV pour le convertir en encaissé
          </span>
        </div>
        <div className="table-responsive">
          <table className="table-agro">
            <thead>
              <tr><th>Date</th><th>Client</th><th>Montant</th><th>Mode</th><th>Statut</th><th>Échéance VNV</th><th>Référence</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {[...paiementsFiltres]
                .sort((a,b)=>new Date(b.date)-new Date(a.date))
                .filter(p=>!selectedClient||p.clientId===selectedClient)
                .map(p => {
                  const cl = clients.find(c=>c.id===p.clientId)
                  const isVNV = p.statut==='vnv'
                  const isEnc = p.statut==='encaisse'||!p.statut
                  return (
                    <tr key={p.id}>
                      <td>{fmtDate(p.date)}</td>
                      <td><strong>{cl?cl.nom:'?'}</strong></td>
                      <td className="amount-pos">{MAD(p.montant)}</td>
                      <td>
                        <span style={{background:'var(--primary-ultra)',color:'var(--primary)',fontSize:11.5,fontWeight:600,padding:'2px 9px',borderRadius:5}}>
                          {p.mode}
                        </span>
                      </td>
                      <td>
                        {isVNV ? (
                          <button
                            title="Cliquer pour convertir en Encaissé"
                            onClick={()=>convertVNV(p)}
                            style={{background:'rgba(232,160,32,0.12)',color:'#E8A020',fontSize:11.5,fontWeight:700,
                              padding:'3px 10px',borderRadius:5,border:'1px dashed #E8A020',cursor:'pointer',
                              transition:'all 0.2s'}}
                            onMouseOver={e=>{e.target.style.background='rgba(232,160,32,0.25)'}}
                            onMouseOut={e=>{e.target.style.background='rgba(232,160,32,0.12)'}}
                          >
                            🟠 VNV → cliquer pour encaisser
                          </button>
                        ) : (
                          <span style={{background:'rgba(61,153,112,0.12)',color:'#3D9970',fontSize:11.5,fontWeight:700,padding:'3px 10px',borderRadius:5}}>
                            🟢 Encaissé
                          </span>
                        )}
                      </td>
                      <td style={{fontSize:12,color:isVNV?'#E8A020':'var(--text-soft)',fontWeight:isVNV?700:400}}>
                        {p.dateEcheance ? (
                          <span>
                            <i className="bi bi-calendar-event me-1"></i>
                            {fmtDate(p.dateEcheance)}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{fontSize:12,color:'var(--text-soft)'}}>{p.ref||'—'}</td>
                      <td>
                        <div className="d-flex gap-1">
                          <button className="btn-icon" title="Modifier" onClick={()=>openEditModal(p)}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn-icon btn-danger" title="Supprimer" onClick={()=>handleDeletePay(p)}>
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              }
              {paiementsFiltres.length===0 && (
                <tr><td colSpan={8} style={{textAlign:'center',padding:24,color:'var(--text-soft)'}}>Aucun paiement sur cette période</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Nouveau Paiement ─────────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay-agro" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal-agro">
            <div className="modal-title-agro">
              <i className="bi bi-cash-coin" style={{color:'var(--primary)'}}></i>
              Enregistrer un Paiement
            </div>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label-agro">Client *</label>
                <select className="form-control-agro" value={form.clientId} onChange={e=>handleClientChange(e.target.value)}>
                  <option value="">-- Sélectionner --</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>

              {form.clientId && (() => {
                const s = getStatutsMontants(form.clientId, commandes, paiements)
                return (
                  <div className="col-12">
                    <div style={{background:'var(--bg)',borderRadius:8,padding:'10px 14px',fontSize:12,display:'flex',gap:16}}>
                      <span>Non Payé : <strong className="amount-neg">{MAD(s.nonPaye)}</strong></span>
                      <span>VNV : <strong style={{color:'#E8A020'}}>{MAD(s.vnv)}</strong></span>
                      <span>Encaissé : <strong className="amount-pos">{MAD(s.encaisse)}</strong></span>
                    </div>
                  </div>
                )
              })()}

              <div className="col-12">
                <label className="form-label-agro">Commande (optionnel)</label>
                <select className="form-control-agro" value={form.commandeId} onChange={e=>setForm(f=>({...f,commandeId:e.target.value}))}>
                  <option value="">-- Toutes commandes --</option>
                  {clientCmds.map(c=>{
                    const restant=getTotal(c)-(c.paiementRecu||0)
                    return <option key={c.id} value={c.id}>{fmtDate(c.date)} — Restant: {MAD(restant)}</option>
                  })}
                </select>
              </div>

              <div className="col-6">
                <label className="form-label-agro">Date *</label>
                <input className="form-control-agro" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Montant (MAD) *</label>
                <input className="form-control-agro" type="number" min="0" value={form.montant} onChange={e=>setForm(f=>({...f,montant:e.target.value}))} />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Mode de Paiement</label>
                <select className="form-control-agro" value={form.mode} onChange={e=>setForm(f=>({...f,mode:e.target.value}))}>
                  {MODES_PAIEMENT.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label-agro">Statut *</label>
                <select className="form-control-agro" value={form.statut} onChange={e=>setForm(f=>({...f,statut:e.target.value}))}
                  style={{borderColor:form.statut==='encaisse'?'#3D9970':form.statut==='vnv'?'#E8A020':'var(--border)'}}>
                  <option value="encaisse">🟢 Encaissé</option>
                  <option value="vnv">🟠 VNV — Valeur Non Versée</option>
                </select>
              </div>
              {form.statut==='vnv' && (
                <div className="col-6">
                  <label className="form-label-agro">Date d'Échéance du Chèque *</label>
                  <input className="form-control-agro" type="date" value={form.dateEcheance}
                    onChange={e=>setForm(f=>({...f,dateEcheance:e.target.value}))} style={{borderColor:'#E8A020'}} />
                </div>
              )}
              <div className={form.statut==='vnv'?'col-6':'col-12'}>
                <label className="form-label-agro">Référence (N° Chèque...)</label>
                <input className="form-control-agro" value={form.ref} onChange={e=>setForm(f=>({...f,ref:e.target.value}))} placeholder="CHQ-12345" />
              </div>
              {form.statut==='vnv' && (
                <div className="col-12">
                  <div style={{background:'rgba(232,160,32,0.08)',border:'1px solid rgba(232,160,32,0.3)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#92710A'}}>
                    <i className="bi bi-info-circle me-2"></i>
                    <strong>VNV</strong> : Le chèque est en votre possession. Pour l'encaisser plus tard, cliquez sur le bouton VNV dans l'historique.
                  </div>
                </div>
              )}
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

      {/* ── Modal Modifier Paiement ────────────────────────────────────────── */}
      {editModal && editForm && (
        <div className="modal-overlay-agro" onClick={e=>e.target===e.currentTarget&&setEditModal(false)}>
          <div className="modal-agro">
            <div className="modal-title-agro">
              <i className="bi bi-pencil-square" style={{color:'var(--primary)'}}></i>
              Modifier le Paiement
            </div>

            {/* Info client */}
            <div style={{background:'var(--bg)',borderRadius:8,padding:'8px 14px',marginBottom:14,fontSize:12,color:'var(--text-soft)'}}>
              <i className="bi bi-person me-2"></i>
              {clients.find(c=>c.id===editForm.clientId)?.nom || '?'}
            </div>

            <div className="row g-3">
              <div className="col-6">
                <label className="form-label-agro">Date *</label>
                <input className="form-control-agro" type="date" value={editForm.date}
                  onChange={e=>setEditForm(f=>({...f,date:e.target.value}))} />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Montant (MAD) *</label>
                <input className="form-control-agro" type="number" min="0" value={editForm.montant}
                  onChange={e=>setEditForm(f=>({...f,montant:e.target.value}))} />
              </div>
              <div className="col-6">
                <label className="form-label-agro">Mode de Paiement</label>
                <select className="form-control-agro" value={editForm.mode}
                  onChange={e=>setEditForm(f=>({...f,mode:e.target.value}))}>
                  {MODES_PAIEMENT.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label-agro">Statut *</label>
                <select className="form-control-agro" value={editForm.statut}
                  onChange={e=>setEditForm(f=>({...f,statut:e.target.value}))}
                  style={{borderColor:editForm.statut==='encaisse'?'#3D9970':'#E8A020'}}>
                  <option value="encaisse">🟢 Encaissé</option>
                  <option value="vnv">🟠 VNV — Valeur Non Versée</option>
                </select>
              </div>
              {editForm.statut==='vnv' && (
                <div className="col-6">
                  <label className="form-label-agro">Date d'Échéance *</label>
                  <input className="form-control-agro" type="date" value={editForm.dateEcheance||''}
                    onChange={e=>setEditForm(f=>({...f,dateEcheance:e.target.value}))}
                    style={{borderColor:'#E8A020'}} />
                </div>
              )}
              <div className={editForm.statut==='vnv'?'col-6':'col-12'}>
                <label className="form-label-agro">Référence</label>
                <input className="form-control-agro" value={editForm.ref||''}
                  onChange={e=>setEditForm(f=>({...f,ref:e.target.value}))} placeholder="CHQ-12345" />
              </div>

              {/* Avertissement suppression */}
              <div className="col-12">
                <div style={{background:'rgba(192,57,43,0.07)',border:'1px solid rgba(192,57,43,0.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#92392B'}}>
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Modifier le montant n'ajuste pas automatiquement les commandes liées. Vérifiez la cohérence des données.
                </div>
              </div>
            </div>

            <div className="modal-footer-agro">
              <button className="btn-outline-agro" onClick={()=>setEditModal(false)}>Annuler</button>
              <button className="btn-primary-agro" onClick={handleEditSave} disabled={editSaving}>
                {editSaving?<><span className="spinner-border spinner-border-sm me-2"></span>Enregistrement...</>:'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}