import { useEffect, useState, useMemo } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, Tooltip, Legend, Filler
} from 'chart.js'
import { getAll, COLS, MAD, fmtDate, getTotal } from '../firebase'
import ReleveClient from '../components/ReleveClient'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler)

const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

// ── Helpers période ────────────────────────────────────────────────────────
function filterByPeriode(items, dateField, periode, customDebut, customFin) {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()
  return items.filter(item => {
    const d = new Date(item[dateField])
    if (periode === 'mois')    return d.getMonth()===month && d.getFullYear()===year
    if (periode === 'trim')    return Math.floor(d.getMonth()/3)===Math.floor(month/3) && d.getFullYear()===year
    if (periode === 'annee')   return d.getFullYear()===year
    if (periode === 'custom' && customDebut && customFin)
      return d >= new Date(customDebut) && d <= new Date(customFin)
    return true
  })
}

export default function Analyses({ showToast }) {
  const [clients, setClients]     = useState([])
  const [commandes, setCommandes] = useState([])
  const [paiements, setPaiements] = useState([])
  const [produits, setProduits]   = useState([])
  const [loading, setLoading]     = useState(true)

  // Filtres
  const [periode, setPeriode]         = useState('annee')
  const [customDebut, setCustomDebut] = useState('')
  const [customFin, setCustomFin]     = useState('')
  const [topN, setTopN]               = useState(10)
  const [tab, setTab]                 = useState('ca') // 'ca' | 'encaissement' | 'produits'
  const [clientReleve, setClientReleve] = useState(null) // client pour le relevé

  useEffect(() => {
    Promise.all([getAll(COLS.clients), getAll(COLS.commandes), getAll(COLS.paiements), getAll(COLS.produits)])
      .then(([cl, cmd, pa, pr]) => { setClients(cl); setCommandes(cmd); setPaiements(pa); setProduits(pr) })
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  // ── Commandes filtrées ────────────────────────────────────────────────────
  const commandesFiltrees = useMemo(() =>
    filterByPeriode(commandes, 'date', periode, customDebut, customFin),
  [commandes, periode, customDebut, customFin])

  // ── Paiements filtrés ─────────────────────────────────────────────────────
  const paiementsFiltres = useMemo(() =>
    filterByPeriode(paiements, 'date', periode, customDebut, customFin),
  [paiements, periode, customDebut, customFin])

  // ── #6 CA par client ──────────────────────────────────────────────────────
  const caParClient = useMemo(() => {
    return clients.map(c => {
      const cCmds = commandesFiltrees.filter(cmd => cmd.clientId === c.id)
      const ca    = cCmds.reduce((s, cmd) => s + getTotal(cmd), 0)
      const paye  = paiementsFiltres.filter(p => p.clientId === c.id).reduce((s, p) => s + p.montant, 0)
      const nbCmds = cCmds.length
      return { ...c, ca, paye, restant: ca - paye, nbCmds }
    })
    .filter(c => c.ca > 0)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, topN)
  }, [clients, commandesFiltrees, paiementsFiltres, topN])

  const barCAData = {
    labels: caParClient.map(c => c.nom.length > 15 ? c.nom.substring(0,15)+'...' : c.nom),
    datasets: [
      {
        label: 'CA Total',
        data: caParClient.map(c => c.ca),
        backgroundColor: '#7B0D1E',
        borderRadius: 6,
      },
      {
        label: 'Encaissé',
        data: caParClient.map(c => c.paye),
        backgroundColor: '#3D9970',
        borderRadius: 6,
      },
      {
        label: 'Restant',
        data: caParClient.map(c => c.restant),
        backgroundColor: '#E8C547',
        borderRadius: 6,
      },
    ]
  }

  const barOpts = {
    responsive: true,
    interaction: { mode:'index', intersect:false },
    plugins: {
      legend: { labels: { color:'var(--text-soft)', font:{ family:'DM Sans', size:12 } } },
      tooltip: { backgroundColor:'var(--bg-card)', borderColor:'var(--border)', borderWidth:1,
        titleColor:'var(--text-main)', bodyColor:'var(--text-soft)',
        callbacks: { label: c => ` ${c.dataset.label}: ${MAD(c.raw)}` }
      }
    },
    scales: {
      x: { ticks:{ color:'var(--text-soft)', font:{ family:'DM Sans', size:11 } }, grid:{ color:'var(--border)' } },
      y: { ticks:{ color:'var(--text-soft)', font:{ family:'DM Sans' }, callback: v => 'MAD '+(v/1000).toFixed(0)+'k' }, grid:{ color:'var(--border)' } }
    }
  }

  // ── #7 Situation encaissements par client ─────────────────────────────────
  const situationEncaissement = useMemo(() => {
    return clients.map(c => {
      const cCmds   = commandesFiltrees.filter(cmd => cmd.clientId === c.id)
      const totalDu = cCmds.reduce((s, cmd) => s + getTotal(cmd), 0)
      const cPay    = paiementsFiltres.filter(p => p.clientId === c.id)
      const encaisse = cPay.filter(p => p.statut === 'encaisse' || !p.statut).reduce((s,p) => s+p.montant, 0)
      const vnvPaiements = cPay.filter(p => p.statut === 'vnv')
      const vnv      = vnvPaiements.reduce((s,p) => s+p.montant, 0)
      const nonPaye  = Math.max(0, totalDu - encaisse - vnv)
      const taux     = totalDu > 0 ? Math.round(encaisse/totalDu*100) : 0
      // Dates VNV avec montants
      const vnvDetails = vnvPaiements.map(p => ({
        montant: p.montant,
        dateEcheance: p.dateEcheance,
        ref: p.ref || ''
      }))
      return { ...c, totalDu, encaisse, vnv, nonPaye, taux, nbCmds: cCmds.length, vnvDetails }
    })
    .filter(c => c.totalDu > 0 || c.encaisse > 0)
    .sort((a,b) => b.totalDu - a.totalDu)
  }, [clients, commandesFiltrees, paiementsFiltres])

  // Totaux globaux
  const totaux = useMemo(() => situationEncaissement.reduce((acc, c) => ({
    totalDu:  acc.totalDu  + c.totalDu,
    encaisse: acc.encaisse + c.encaisse,
    vnv:      acc.vnv      + c.vnv,
    nonPaye:  acc.nonPaye  + c.nonPaye,
  }), { totalDu:0, encaisse:0, vnv:0, nonPaye:0 }), [situationEncaissement])

  // ── Ventes par produit ────────────────────────────────────────────────────
  const ventesParProduit = useMemo(() => {
    const map = {}
    commandesFiltrees.forEach(cmd => {
      ;(cmd.lignes||[]).forEach(l => {
        const prod = produits.find(p => p.id === l.produitId)
        const nom  = prod ? prod.nom : l.produitId
        const cat  = prod ? prod.categorie : 'Autre'
        if (!map[nom]) map[nom] = { nom, categorie: cat, qte: 0, ca: 0 }
        map[nom].qte += l.qte
        map[nom].ca  += l.qte * l.prixUnit
      })
    })
    return Object.values(map).sort((a,b) => b.ca - a.ca).slice(0, 10)
  }, [commandesFiltrees, produits])

  // ── Export PDF Situation Encaissements ───────────────────────────────────
  function exportSituationPDF(data, totaux, periode, debut, fin) {
    const today = new Date().toLocaleDateString('fr-MA', { day:'2-digit', month:'2-digit', year:'numeric' })
    const periodeLabel =
      periode === 'mois'   ? `Ce mois (${new Date().toLocaleDateString('fr-MA', { month:'long', year:'numeric' })})` :
      periode === 'trim'   ? `Ce trimestre ${Math.floor(new Date().getMonth()/3)+1} — ${new Date().getFullYear()}` :
      periode === 'annee'  ? `Année ${new Date().getFullYear()}` :
      periode === 'custom' && debut && fin ? `Du ${new Date(debut).toLocaleDateString('fr-MA')} au ${new Date(fin).toLocaleDateString('fr-MA')}` :
      'Toute période'

    const tauxGlobal = totaux.totalDu > 0 ? Math.round(totaux.encaisse / totaux.totalDu * 100) : 0

    const rowsHTML = data.map((c, i) => {
      const statut =
        c.nonPaye === 0 && c.vnv === 0 ? '<span style="color:#3D9970;font-weight:700">✓ Soldé</span>' :
        c.vnv > 0 && c.nonPaye === 0   ? '<span style="color:#E8A020;font-weight:700">VNV</span>' :
        '<span style="color:#C0392B;font-weight:700">En cours</span>'
      const tauxColor = c.taux>=70?'#3D9970':c.taux>=40?'#E8A020':'#C0392B'

      // Dates VNV formatées
      const vnvDatesHTML = c.vnvDetails && c.vnvDetails.length > 0
        ? c.vnvDetails.map(v =>
            `<div style="font-size:9.5px;color:#E8A020;white-space:nowrap">
              ${v.montant.toLocaleString('fr-MA')} MAD
              ${v.dateEcheance ? `→ <strong>${new Date(v.dateEcheance).toLocaleDateString('fr-MA')}</strong>` : ''}
              ${v.ref ? `(${v.ref})` : ''}
            </div>`
          ).join('')
        : '<span style="color:#aaa">—</span>'

      return `
        <tr class="${i%2===0?'even':''}">
          <td><strong>${c.nom}</strong></td>
          <td>${c.zone}</td>
          <td class="center">${c.nbCmds}</td>
          <td class="num">${c.totalDu.toLocaleString('fr-MA')} MAD</td>
          <td class="num green">${c.encaisse.toLocaleString('fr-MA')} MAD</td>
          <td class="num orange">${c.vnv > 0 ? c.vnv.toLocaleString('fr-MA')+' MAD' : '—'}</td>
          <td>${vnvDatesHTML}</td>
          <td class="num red">${c.nonPaye > 0 ? c.nonPaye.toLocaleString('fr-MA')+' MAD' : '—'}</td>
          <td class="center" style="color:${tauxColor};font-weight:700">${c.taux}%</td>
          <td class="center">${statut}</td>
        </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Situation des Encaissements — AgroAbdo</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 28px; }

  .header-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
  .company h1 { font-size:20px; font-weight:bold; color:#7B0D1E; letter-spacing:1px; }
  .company p { font-size:10px; color:#666; margin-top:3px; }
  .date-info { text-align:right; font-size:10px; color:#555; line-height:1.7; }

  .rapport-title { text-align:center; margin:18px 0 6px; }
  .rapport-title h2 { font-size:15px; font-weight:bold; text-transform:uppercase; letter-spacing:1px; color:#1a1a1a; }
  .rapport-title p { font-size:10px; color:#666; margin-top:3px; }

  .divider { border:none; border-top:2px solid #7B0D1E; margin:12px 0; }

  .intro { font-size:11px; line-height:1.8; margin-bottom:16px; color:#333; }
  .intro strong { color:#7B0D1E; }

  .kpi-row { display:flex; gap:12px; margin-bottom:18px; }
  .kpi-box { flex:1; border:1px solid #ddd; border-radius:6px; padding:10px 12px; }
  .kpi-box .lbl { font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:4px; }
  .kpi-box .val { font-size:14px; font-weight:bold; }
  .kpi-box.green .val { color:#3D9970; }
  .kpi-box.orange .val { color:#E8A020; }
  .kpi-box.red .val { color:#C0392B; }
  .kpi-box.primary { border-color:#7B0D1E; }
  .kpi-box.primary .val { color:#7B0D1E; }

  table { width:100%; border-collapse:collapse; font-size:10.5px; }
  thead th { background:#7B0D1E; color:white; padding:8px 7px; font-size:10px; text-align:left; }
  thead th.center, td.center { text-align:center; }
  thead th.num, td.num { text-align:right; }
  td { padding:6px 7px; border-bottom:1px solid #eee; vertical-align:middle; }
  tr.even td { background:#fdf8f8; }
  .green { color:#3D9970; font-weight:600; }
  .orange { color:#E8A020; font-weight:600; }
  .red { color:#C0392B; font-weight:600; }

  .total-row td { background:#f5f0f0 !important; font-weight:bold; border-top:2px solid #7B0D1E; padding:9px 7px; font-size:11px; }
  .solde-row td { background:#7B0D1E !important; color:white !important; font-weight:bold; font-size:12px; padding:10px 7px; }
  .solde-row td.num { text-align:right; }

  .conclusion { margin-top:24px; font-size:11px; line-height:1.8; color:#333; }
  .conclusion .highlight { background:#f5f0f0; border-left:3px solid #7B0D1E; padding:10px 14px; border-radius:0 6px 6px 0; margin:12px 0; }
  .footer { margin-top:28px; font-size:10px; color:#888; border-top:1px solid #ddd; padding-top:10px; display:flex; justify-content:space-between; }

  @media print { body { padding:15px; } }
</style>
</head>
<body>

<div class="header-top">
  <div class="company">
    <h1>🌿 AGROABDO</h1>
    <p>Système de Gestion Agrofournitures — Maroc</p>
  </div>
  <div class="date-info">
    Édité le : <strong>${today}</strong><br>
    Période : <strong>${periodeLabel}</strong><br>
    Nb clients : <strong>${data.length}</strong>
  </div>
</div>

<hr class="divider">

<div class="rapport-title">
  <h2>Rapport de Situation des Encaissements</h2>
  <p>Synthèse financière — ${periodeLabel}</p>
</div>

<hr class="divider">

<p class="intro">
  Messieurs,<br><br>
  Nous avons l'honneur de vous présenter le rapport de situation des encaissements de la période
  <strong>${periodeLabel}</strong>. Ce document synthétise l'état du recouvrement client,
  distinguant les montants effectivement encaissés, les valeurs non versées (VNV — chèques en attente d'encaissement)
  et les montants restant impayés.<br><br>
  Le taux global de recouvrement pour cette période s'établit à <strong>${tauxGlobal}%</strong>
  sur un chiffre d'affaires total de <strong>${totaux.totalDu.toLocaleString('fr-MA')} MAD</strong>.
</p>

<div class="kpi-row">
  <div class="kpi-box primary">
    <div class="lbl">Total CA Période</div>
    <div class="val">${totaux.totalDu.toLocaleString('fr-MA')} MAD</div>
  </div>
  <div class="kpi-box green">
    <div class="lbl">🟢 Encaissé</div>
    <div class="val">${totaux.encaisse.toLocaleString('fr-MA')} MAD</div>
  </div>
  <div class="kpi-box orange">
    <div class="lbl">🟠 VNV</div>
    <div class="val">${totaux.vnv.toLocaleString('fr-MA')} MAD</div>
  </div>
  <div class="kpi-box red">
    <div class="lbl">🔴 Non Payé</div>
    <div class="val">${totaux.nonPaye.toLocaleString('fr-MA')} MAD</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Client</th>
      <th>Zone</th>
      <th class="center">Cmds</th>
      <th class="num">Total Dû</th>
      <th class="num">Encaissé</th>
      <th class="num">VNV Montant</th>
      <th>VNV Échéance</th>
      <th class="num">Non Payé</th>
      <th class="center">Taux</th>
      <th class="center">Statut</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHTML}
    <tr class="total-row">
      <td colspan="3">TOTAL — ${data.length} clients</td>
      <td class="num">${totaux.totalDu.toLocaleString('fr-MA')} MAD</td>
      <td class="num green">${totaux.encaisse.toLocaleString('fr-MA')} MAD</td>
      <td class="num orange">${totaux.vnv > 0 ? totaux.vnv.toLocaleString('fr-MA')+' MAD' : '—'}</td>
      <td>—</td>
      <td class="num red">${totaux.nonPaye > 0 ? totaux.nonPaye.toLocaleString('fr-MA')+' MAD' : '—'}</td>
      <td class="center" style="color:${tauxGlobal>=70?'#3D9970':tauxGlobal>=40?'#E8A020':'#C0392B'};font-weight:800">${tauxGlobal}%</td>
      <td></td>
    </tr>
  </tbody>
</table>

<div class="conclusion">
  <div class="highlight">
    <strong>Synthèse :</strong> Sur un total de <strong>${totaux.totalDu.toLocaleString('fr-MA')} MAD</strong>
    de chiffre d'affaires réalisé durant la période <strong>${periodeLabel}</strong> :<br>
    • <strong style="color:#3D9970">${totaux.encaisse.toLocaleString('fr-MA')} MAD</strong> ont été effectivement encaissés (${tauxGlobal}%)<br>
    ${totaux.vnv > 0 ? `• <strong style="color:#E8A020">${totaux.vnv.toLocaleString('fr-MA')} MAD</strong> sont en attente d'encaissement (chèques VNV)<br>` : ''}
    ${totaux.nonPaye > 0 ? `• <strong style="color:#C0392B">${totaux.nonPaye.toLocaleString('fr-MA')} MAD</strong> restent impayés et nécessitent une action de recouvrement` : '• Tous les montants sont couverts (encaissés ou VNV)'}
  </div>
</div>

<div class="footer">
  <span>AgroAbdo — Rapport confidentiel</span>
  <span>Généré le ${today}</span>
</div>

</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.print() }, 500)
  }

  if (loading) return <div className="loading-box"><div className="spinner-agro"></div><p>Chargement analyses...</p></div>

  const totalCA    = caParClient.reduce((s,c) => s+c.ca, 0)
  const totalPaye2 = caParClient.reduce((s,c) => s+c.paye, 0)

  return (
    <div>
      {/* ── Stats globales ───────────────────────────────────────────────── */}
      <div className="row g-3 mb-3">
        {[
          { label:'CA Période',         val: MAD(totaux.totalDu),   cls:'amount-pos'  },
          { label:'🟢 Encaissé',        val: MAD(totaux.encaisse),  cls:'amount-pos'  },
          { label:'🟠 VNV',             val: MAD(totaux.vnv),       cls:'',           style:{ color:'#E8A020', fontWeight:700 } },
          { label:'🔴 Non Payé',        val: MAD(totaux.nonPaye),   cls:'amount-neg'  },
        ].map(s => (
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="stat-box">
              <span className={`stat-val ${s.cls}`} style={s.style}>{s.val}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filtres ──────────────────────────────────────────────────────── */}
      <div className="card-agro mb-3">
        <div style={{ padding:'14px 18px', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:12, color:'var(--text-soft)', fontWeight:600 }}>Période :</span>
          {[['mois','Ce mois'],['trim','Ce trimestre'],['annee','Cette année'],['all','Toute période'],['custom','Personnalisée']].map(([val,lbl]) => (
            <button key={val} onClick={() => setPeriode(val)}
              style={{
                padding:'5px 14px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer',
                border:`1px solid ${periode===val?'var(--primary)':'var(--border)'}`,
                background: periode===val ? 'var(--primary)' : 'none',
                color: periode===val ? 'white' : 'var(--text-soft)',
                fontFamily:'var(--font-body)', transition:'all 0.2s',
              }}>{lbl}</button>
          ))}

          {periode === 'custom' && (
            <>
              <input type="date" className="form-control-agro" style={{ width:'auto' }}
                value={customDebut} onChange={e => setCustomDebut(e.target.value)} />
              <span style={{ color:'var(--text-soft)', fontSize:13 }}>→</span>
              <input type="date" className="form-control-agro" style={{ width:'auto' }}
                value={customFin} onChange={e => setCustomFin(e.target.value)} />
            </>
          )}

          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, color:'var(--text-soft)' }}>Top :</span>
            {[5,10,20].map(n => (
              <button key={n} onClick={() => setTopN(n)}
                style={{ padding:'4px 12px', borderRadius:5, fontSize:12, fontWeight:600, cursor:'pointer',
                  border:`1px solid ${topN===n?'var(--primary)':'var(--border)'}`,
                  background: topN===n?'var(--primary)':'none',
                  color: topN===n?'white':'var(--text-soft)',
                  fontFamily:'var(--font-body)',
                }}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="tabs-agro">
        <button className={`tab-btn-agro ${tab==='ca'?'active':''}`} onClick={()=>setTab('ca')}>
          <i className="bi bi-bar-chart-fill me-1"></i> CA par Client
        </button>
        <button className={`tab-btn-agro ${tab==='encaissement'?'active':''}`} onClick={()=>setTab('encaissement')}>
          <i className="bi bi-cash-stack me-1"></i> Situation Encaissements
        </button>
        <button className={`tab-btn-agro ${tab==='produits'?'active':''}`} onClick={()=>setTab('produits')}>
          <i className="bi bi-box-seam me-1"></i> Ventes par Produit
        </button>
      </div>

      {/* ── TAB #6 : CA par client ────────────────────────────────────────── */}
      {tab === 'ca' && (
        <div>
          {/* Graphique */}
          <div className="card-agro mb-3">
            <div className="card-header-agro">
              <span className="card-title-agro">Chiffre d'Affaires par Client</span>
              <span style={{ fontSize:12, color:'var(--text-soft)' }}>Total : {MAD(totalCA)}</span>
            </div>
            <div style={{ padding:'16px 18px' }}>
              {caParClient.length === 0
                ? <div style={{ textAlign:'center', padding:30, color:'var(--text-soft)' }}>Aucune vente sur cette période</div>
                : <Bar data={barCAData} options={barOpts} />
              }
            </div>
          </div>

          {/* Tableau détaillé */}
          <div className="card-agro">
            <div className="card-header-agro">
              <span className="card-title-agro">Détail par Client</span>
              <span style={{ fontSize:11, color:'var(--text-soft)', fontStyle:'italic' }}>
                <i className="bi bi-hand-index me-1"></i>Cliquer sur un client pour voir son relevé
              </span>
            </div>
            <div className="table-responsive">
              <table className="table-agro">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Client</th>
                    <th>Zone</th>
                    <th>Nb Cmds</th>
                    <th>CA Total</th>
                    <th>Encaissé</th>
                    <th>Restant</th>
                    <th>% du CA</th>
                  </tr>
                </thead>
                <tbody>
                  {caParClient.map((c, i) => (
                    <tr key={c.id}
                      onClick={() => setClientReleve(c)}
                      style={{ cursor:'pointer' }}
                      title="Cliquer pour voir le relevé de compte"
                    >
                      <td style={{ color:'var(--text-soft)', fontWeight:700 }}>#{i+1}</td>
                      <td><strong>{c.nom}</strong></td>
                      <td><span className="badge-zone">{c.zone}</span></td>
                      <td style={{ color:'var(--text-soft)' }}>{c.nbCmds}</td>
                      <td className="amount-pos">{MAD(c.ca)}</td>
                      <td style={{ color:'#3D9970', fontWeight:600 }}>{MAD(c.paye)}</td>
                      <td className={c.restant>0?'amount-neg':'amount-pos'}>{MAD(c.restant)}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:60, height:5, background:'var(--border)', borderRadius:3 }}>
                            <div style={{ width:`${totalCA>0?Math.round(c.ca/totalCA*100):0}%`, height:'100%', background:'var(--primary)', borderRadius:3 }}></div>
                          </div>
                          <span style={{ fontSize:11, color:'var(--text-soft)' }}>
                            {totalCA>0?Math.round(c.ca/totalCA*100):0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Total */}
                  {caParClient.length > 0 && (
                    <tr style={{ background:'var(--primary-ultra)', fontWeight:700 }}>
                      <td colSpan={4} style={{ fontWeight:700, color:'var(--primary)' }}>TOTAL</td>
                      <td className="amount-pos">{MAD(totalCA)}</td>
                      <td style={{ color:'#3D9970', fontWeight:700 }}>{MAD(totalPaye2)}</td>
                      <td className="amount-neg">{MAD(totalCA-totalPaye2)}</td>
                      <td>100%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB #7 : Situation encaissements ─────────────────────────────── */}
      {tab === 'encaissement' && (
        <div className="card-agro">
          <div className="card-header-agro">
            <span className="card-title-agro">Situation des Encaissements</span>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:12, color:'var(--text-soft)' }}>
                {situationEncaissement.length} clients actifs
              </span>
              <button className="btn-primary-agro" onClick={() => exportSituationPDF(situationEncaissement, totaux, periode, customDebut, customFin)}>
                <i className="bi bi-file-earmark-pdf-fill"></i> Exporter PDF
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table-agro">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Zone</th>
                  <th>Cmds</th>
                  <th>Total Dû</th>
                  <th style={{ color:'#3D9970' }}>🟢 Encaissé</th>
                  <th style={{ color:'#E8A020' }}>🟠 VNV</th>
                  <th style={{ color:'#C0392B' }}>🔴 Non Payé</th>
                  <th>Taux</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {situationEncaissement.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.nom}</strong></td>
                    <td><span className="badge-zone">{c.zone}</span></td>
                    <td style={{ color:'var(--text-soft)' }}>{c.nbCmds}</td>
                    <td className="amount-warn">{MAD(c.totalDu)}</td>
                    <td style={{ color:'#3D9970', fontWeight:600 }}>{MAD(c.encaisse)}</td>
                    <td>
                      {c.vnv > 0
                        ? <span style={{ background:'rgba(232,160,32,0.12)', color:'#E8A020', fontWeight:700, padding:'2px 8px', borderRadius:5, fontSize:11.5 }}>{MAD(c.vnv)}</span>
                        : <span style={{ color:'var(--text-soft)' }}>—</span>
                      }
                    </td>
                    <td>
                      {c.nonPaye > 0
                        ? <span className="badge-retard">{MAD(c.nonPaye)}</span>
                        : <span style={{ color:'var(--text-soft)' }}>—</span>
                      }
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ width:50, height:5, background:'var(--border)', borderRadius:3 }}>
                          <div style={{ width:`${c.taux}%`, height:'100%', borderRadius:3,
                            background: c.taux>=70?'#3D9970':c.taux>=40?'#E8A020':'#C0392B' }}></div>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700,
                          color: c.taux>=70?'#3D9970':c.taux>=40?'#E8A020':'#C0392B' }}>
                          {c.taux}%
                        </span>
                      </div>
                    </td>
                    <td>
                      {c.nonPaye === 0 && c.vnv === 0
                        ? <span className="badge-ok">✓ Soldé</span>
                        : c.vnv > 0 && c.nonPaye === 0
                          ? <span style={{ background:'rgba(232,160,32,0.12)', color:'#E8A020', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:5 }}>VNV</span>
                          : <span className="badge-retard">En cours</span>
                      }
                    </td>
                  </tr>
                ))}

                {/* Ligne totaux */}
                {situationEncaissement.length > 0 && (
                  <tr style={{ background:'var(--primary-ultra)', fontWeight:700 }}>
                    <td colSpan={3} style={{ color:'var(--primary)', fontWeight:700 }}>TOTAL</td>
                    <td className="amount-warn">{MAD(totaux.totalDu)}</td>
                    <td style={{ color:'#3D9970', fontWeight:700 }}>{MAD(totaux.encaisse)}</td>
                    <td style={{ color:'#E8A020', fontWeight:700 }}>{MAD(totaux.vnv)}</td>
                    <td className="amount-neg">{MAD(totaux.nonPaye)}</td>
                    <td>
                      <span style={{ fontWeight:700, color: totaux.totalDu>0 && Math.round(totaux.encaisse/totaux.totalDu*100)>=70?'#3D9970':'#C0392B' }}>
                        {totaux.totalDu>0?Math.round(totaux.encaisse/totaux.totalDu*100):0}%
                      </span>
                    </td>
                    <td></td>
                  </tr>
                )}

                {situationEncaissement.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign:'center', padding:30, color:'var(--text-soft)' }}>Aucune donnée sur cette période</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB Ventes par produit ────────────────────────────────────────── */}
      {tab === 'produits' && (
        <div className="card-agro">
          <div className="card-header-agro">
            <span className="card-title-agro">Top Produits Vendus</span>
          </div>
          <div className="table-responsive">
            <table className="table-agro">
              <thead>
                <tr><th>#</th><th>Produit</th><th>Catégorie</th><th>Qté Vendue</th><th>CA Généré</th><th>% du CA</th></tr>
              </thead>
              <tbody>
                {ventesParProduit.map((p, i) => {
                  const totalCAProduits = ventesParProduit.reduce((s,x) => s+x.ca, 0)
                  const pct = totalCAProduits > 0 ? Math.round(p.ca/totalCAProduits*100) : 0
                  return (
                    <tr key={p.nom}>
                      <td style={{ color:'var(--text-soft)', fontWeight:700 }}>#{i+1}</td>
                      <td><strong>{p.nom}</strong></td>
                      <td><span className="badge-zone">{p.categorie}</span></td>
                      <td style={{ fontWeight:600 }}>{p.qte}</td>
                      <td className="amount-pos">{MAD(p.ca)}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:70, height:5, background:'var(--border)', borderRadius:3 }}>
                            <div style={{ width:`${pct}%`, height:'100%', background:'var(--primary)', borderRadius:3 }}></div>
                          </div>
                          <span style={{ fontSize:11, color:'var(--text-soft)' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {ventesParProduit.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:30, color:'var(--text-soft)' }}>Aucune vente sur cette période</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ── Modal Relevé Client ───────────────────────────────────────────── */}
      {clientReleve && (
        <ReleveClient
          client={clientReleve}
          commandes={commandesFiltrees.filter(c => c.clientId === clientReleve.id)}
          paiements={paiementsFiltres.filter(p => p.clientId === clientReleve.id)}
          produits={produits}
          periode={periode}
          onClose={() => setClientReleve(null)}
        />
      )}
    </div>
  )
}