import { useEffect, useState } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { getAll, addItem, updateItem, getSoldeClient, getTotal, COLS, MAD, fmtDate } from '../firebase'

ChartJS.register(ArcElement, Tooltip, Legend)

const MODES = ['Chèque','Virement','Espèces','Traite']

export default function Recouvrement({ showToast }) {
  const [clients, setClients]     = useState([])
  const [commandes, setCommandes] = useState([])
  const [paiements, setPaiements] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ clientId:'', commandeId:'', date: new Date().toISOString().split('T')[0], montant:'', mode:'Chèque', ref:'' })
  const [clientCmds, setClientCmds] = useState([])

  useEffect(() => {
    Promise.all([getAll(COLS.clients), getAll(COLS.commandes), getAll(COLS.paiements)])
      .then(([cl, cmd, pa]) => { setClients(cl); setCommandes(cmd); setPaiements(pa) })
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  // Stats globales
  let totalDu = 0, totalPaye = 0
  clients.forEach(c => {
    const s = getSoldeClient(c.id, commandes, paiements)
    totalDu   += s.totalDu
    totalPaye += s.totalPaye
  })
  const restant = totalDu - totalPaye
  const taux = totalDu > 0 ? Math.round(totalPaye / totalDu * 100) : 0

  const donutData = {
    labels: ['Recouvré','En Attente'],
    datasets: [{ data: [totalPaye, restant], backgroundColor: ['#3D9970','#C0392B'], borderWidth: 0, hoverOffset: 4 }]
  }
  const donutOpts = {
    responsive: true,
    plugins: { legend: { position:'bottom', labels: { color:'#6B7280', font:{ family:'DM Sans', size:12 } } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${MAD(c.raw)}` } } }
  }

  // Rows par client
  const rows = clients.map(c => {
    const { totalDu, totalPaye, solde } = getSoldeClient(c.id, commandes, paiements)
    const lastCmd = commandes.filter(cmd => cmd.clientId === c.id).sort((a,b) => new Date(b.date)-new Date(a.date))[0]
    const retard  = lastCmd ? Math.floor((new Date() - new Date(lastCmd.date)) / 86400000) : 0
    return { ...c, totalDu, totalPaye, solde, retard }
  }).sort((a,b) => b.solde - a.solde)

  function openModal(clientId = '') {
    setForm({ clientId, commandeId:'', date: new Date().toISOString().split('T')[0], montant:'', mode:'Chèque', ref:'' })
    if (clientId) {
      const { solde } = getSoldeClient(clientId, commandes, paiements)
      setForm(f => ({ ...f, clientId, montant: Math.round(solde) }))
      const cmds = commandes.filter(c => c.clientId === clientId && (getTotal(c) - (c.paiementRecu||0)) > 0)
      setClientCmds(cmds)
    } else {
      setClientCmds([])
    }
    setModal(true)
  }

  function handleClientChange(cId) {
    const { solde } = getSoldeClient(cId, commandes, paiements)
    setForm(f => ({ ...f, clientId: cId, montant: Math.round(solde), commandeId:'' }))
    const cmds = commandes.filter(c => c.clientId === cId && (getTotal(c) - (c.paiementRecu||0)) > 0)
    setClientCmds(cmds)
  }

  async function handleSave() {
    if (!form.clientId || !form.montant || !form.date) return showToast('Champs obligatoires', 'error')
    setSaving(true)
    try {
      if (form.commandeId) {
        const cmd = commandes.find(c => c.id === form.commandeId)
        if (cmd) {
          const newPaye = (cmd.paiementRecu||0) + parseFloat(form.montant)
          await updateItem(COLS.commandes, cmd.id, { paiementRecu: newPaye })
          setCommandes(cs => cs.map(c => c.id === cmd.id ? { ...c, paiementRecu: newPaye } : c))
        }
      }
      const data = { ...form, montant: parseFloat(form.montant) }
      const id = await addItem(COLS.paiements, data)
      setPaiements(ps => [{ id, ...data }, ...ps])
      setModal(false)
      showToast('Paiement enregistré ✓')
    } catch(e) { showToast(e.message, 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading-box"><div className="spinner-agro"></div><p>Chargement recouvrement...</p></div>

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-3">
        {[
          { label:'Crédit Accordé',       val: MAD(totalDu),    cls:'amount-warn' },
          { label:'Total Recouvré',        val: MAD(totalPaye),  cls:'amount-pos'  },
          { label:'Restant à Recouvrer',   val: MAD(restant),    cls:'amount-neg'  },
          { label:'Taux de Recouvrement',  val: taux+'%',        cls:''            },
        ].map(s => (
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="stat-box"><span className={`stat-val ${s.cls}`}>{s.val}</span><span className="stat-label">{s.label}</span></div>
          </div>
        ))}
      </div>

      <div className="row g-3 mb-3">
        {/* Donut */}
        <div className="col-lg-4">
          <div className="card-agro p-3 h-100">
            <div className="card-title-agro mb-3">Répartition Recouvrement</div>
            <Doughnut data={donutData} options={donutOpts} />
          </div>
        </div>

        {/* Table clients */}
        <div className="col-lg-8">
          <div className="card-agro h-100">
            <div className="card-header-agro">
              <span className="card-title-agro">Situation par Client</span>
              <button className="btn-primary-agro" onClick={() => openModal()}>
                <i className="bi bi-plus-lg"></i> Enregistrer Paiement
              </button>
            </div>
            <div className="table-responsive">
              <table className="table-agro">
                <thead><tr><th>Client</th><th>Zone</th><th>Total Dû</th><th>Payé</th><th>Solde</th><th>Retard</th><th>Action</th></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.nom}</strong></td>
                      <td><span className="badge-zone">{r.zone}</span></td>
                      <td className="amount-warn">{MAD(r.totalDu)}</td>
                      <td className="amount-pos">{MAD(r.totalPaye)}</td>
                      <td className={r.solde > 0 ? 'amount-neg' : 'amount-pos'}>{MAD(r.solde)}</td>
                      <td>{r.solde > 0 ? <span className="badge-retard">{r.retard}j</span> : <span className="badge-ok">Soldé</span>}</td>
                      <td>
                        {r.solde > 0 && (
                          <button className="btn-icon" onClick={() => openModal(r.id)}>
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
        <div className="card-header-agro"><span className="card-title-agro">Historique des Paiements</span></div>
        <div className="table-responsive">
          <table className="table-agro">
            <thead><tr><th>Date</th><th>Client</th><th>Montant</th><th>Mode</th><th>Référence</th></tr></thead>
            <tbody>
              {[...paiements].sort((a,b) => new Date(b.date)-new Date(a.date)).map(p => {
                const cl = clients.find(c => c.id === p.clientId)
                return (
                  <tr key={p.id}>
                    <td>{fmtDate(p.date)}</td>
                    <td><strong>{cl ? cl.nom : '?'}</strong></td>
                    <td className="amount-pos">{MAD(p.montant)}</td>
                    <td><span style={{ background:'rgba(123,13,30,0.1)', color:'var(--primary)', fontSize:11.5, fontWeight:600, padding:'2px 9px', borderRadius:5 }}>{p.mode}</span></td>
                    <td style={{ color:'var(--text-soft)', fontSize:12 }}>{p.ref||'—'}</td>
                  </tr>
                )
              })}
              {paiements.length === 0 && <tr><td colSpan={5} style={{ textAlign:'center', padding:24, color:'var(--text-soft)' }}>Aucun paiement enregistré</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay-agro" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-agro">
            <div className="modal-title-agro"><i className="bi bi-cash-coin" style={{ color:'var(--primary)' }}></i>Enregistrer un Paiement</div>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label-agro">Client *</label>
                <select className="form-control-agro" value={form.clientId} onChange={e => handleClientChange(e.target.value)}>
                  <option value="">-- Sélectionner --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              {form.clientId && (
                <div className="col-12">
                  <div style={{ background:'var(--bg)', borderRadius:8, padding:'10px 14px', fontSize:13 }}>
                    Solde actuel : <strong className="amount-neg">{MAD(getSoldeClient(form.clientId, commandes, paiements).solde)}</strong>
                  </div>
                </div>
              )}
              <div className="col-12">
                <label className="form-label-agro">Commande (optionnel)</label>
                <select className="form-control-agro" value={form.commandeId} onChange={e => setForm(f=>({...f,commandeId:e.target.value}))}>
                  <option value="">-- Toutes commandes --</option>
                  {clientCmds.map(c => {
                    const restant = getTotal(c) - (c.paiementRecu||0)
                    return <option key={c.id} value={c.id}>{fmtDate(c.date)} — Restant: {MAD(restant)}</option>
                  })}
                </select>
              </div>
              <div className="col-6"><label className="form-label-agro">Date *</label><input className="form-control-agro" type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} /></div>
              <div className="col-6"><label className="form-label-agro">Montant (MAD) *</label><input className="form-control-agro" type="number" min="0" value={form.montant} onChange={e => setForm(f=>({...f,montant:e.target.value}))} /></div>
              <div className="col-6">
                <label className="form-label-agro">Mode de Paiement</label>
                <select className="form-control-agro" value={form.mode} onChange={e => setForm(f=>({...f,mode:e.target.value}))}>
                  {MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-6"><label className="form-label-agro">Référence</label><input className="form-control-agro" value={form.ref} onChange={e => setForm(f=>({...f,ref:e.target.value}))} placeholder="CHQ-12345" /></div>
            </div>
            <div className="modal-footer-agro">
              <button className="btn-outline-agro" onClick={() => setModal(false)}>Annuler</button>
              <button className="btn-primary-agro" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Enregistrement...</> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}